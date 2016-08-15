/* ************************************************** *
 * ******************** Node Modules
 * ************************************************** */

let async = require('async'),
  EventEmitter = require('events'),
  path = require('path'),
  util = require('util');


/* ************************************************** *
 * ******************** Riposte Class
 * ************************************************** */

class Riposte {
  constructor(options) {
    this.setDefault();
    this.set(options);
    EventEmitter.call(this);
  }

  // Create a new reply instance.
  createReply(obj) {
    return new Reply(obj, this);
  }

  addExpressPreMiddleware(app) {
    let self = this;

    app.use(function (req, res, next) {
      res.reply = new Reply(undefined, self, res);

      if(self.logRequests && self.log) {
        switch (req.method) {
          case "POST":
          case "PUT":
            self.log[self.logRequests]('[%s] ' + req.method + ' ' + req.protocol + '://' + req.get('host') + req.originalUrl + '\n\nHeaders: %s\n\nBody: %s', res.reply.id, JSON.stringify(req.headers, undefined, 2), JSON.stringify(req.body, undefined, 2));
            break;
          default:
            self.log[self.logRequests]('[%s] ' + req.method + ' ' + req.protocol + '://' + req.get('host') + req.originalUrl, res.reply.id);
            break;
        }
      }


      next();
    });

    self.state.expressPreMiddlewareEnabled = true;

    return app;
  }

  addExpressPostMiddleware(app) {
    let self = this;
    app.use(function (req, res, next) {
      if(res && res.reply) {
        res.reply.toObject(res.replyOptions, function (err, obj, status) {
          if (err) {
            next(err);
          } else {
            if(self.logReplies && self.log) {
              self.log[self.logReplies]('[%s] Reply with Status Code: %s\nResponse Body: %s', obj.id, status, JSON.stringify(obj, undefined, 2));
            }
            res.status(status).send(obj);
          }
        });
      } else {
        next(new Error("You must call \"addExpressPreMiddleware()\" before \"addExpressPostMiddleware()\"."));
      }
    });

    app.use(function (err, req, res, next) {
      if(err) {
        self.handle(Riposte.HANDLER_TYPE_500, undefined, undefined, function (err, errorObject) {
          if(err) {
            if(self.log) {
              self.log.error(err);
            }
          } else {
            if(self.log) {
              self.log.error(new Error("HANDLER_TYPE_500 requires one or more parameters be returned in the callback method.  Returning a generic error message."));
            }
          }

          if( ! errorObject) {
            errorObject = new Error("An internal server error has occurred.");
          }

          if(self.logReplies && self.log) {
            self.log[self.logReplies]('[%s] Reply with Status Code: 500\nResponse Body: %s', errorObject.id, JSON.stringify(errorObject, undefined, 2));
          }

          res.status(500).send(errorObject);
        });
      }
    });

    self.state.expressPostMiddlewareEnabled = true;

    return app;
  }
  
  get(key) {
    return this[key];
  }

  handle(type, data, options, cb) {
    this.handlers[type](data, options, cb, this);
    return this;
  }

  set(options = {}) {
    for(let key in options) {
      if(options.hasOwnProperty(key)) {
        switch(key) {
          case "i18next":
          case "log":
          case "richErrorOptions":
            this[key] = options[key];
            break;

          case "express":


          default:  // Unsupported option.
            break;
        }
      }
    }

    if(options["RichError"] !== undefined) {
      this["RichError"] = options["RichError"];
    } else {
      // TODO: Create a new RichError instance using the richErrorOptions.
    }

    return this;
  }

  setDefault() {
    this.i18next = undefined;
    this.log = undefined;
    this.logRequests = 'trace';
    this.logReplies = 'trace';
    this.richError = undefined;
    this.richErrorOptions = {                    
      "enableStackTrace": false        // When true, errors returned from the server will include a stack trace.
    };

    this.handlers = {};
    this.use(Riposte.HANDLER_TYPE_400, HANDLER_METHOD_400);
    this.use(Riposte.HANDLER_TYPE_401, HANDLER_METHOD_401);
    this.use(Riposte.HANDLER_TYPE_403, HANDLER_METHOD_403);
    this.use(Riposte.HANDLER_TYPE_404, HANDLER_METHOD_404);
    this.use(Riposte.HANDLER_TYPE_500, HANDLER_METHOD_500);
    this.use(Riposte.HANDLER_TYPE_CREATE_ERROR, HANDLER_METHOD_CREATE_ERROR);
    this.use(Riposte.HANDLER_TYPE_ERROR_TO_OBJECT, HANDLER_METHOD_ERROR_TO_OBJECT);
    this.use(Riposte.HANDLER_TYPE_SANITIZE, HANDLER_METHOD_SANITIZE);
    this.use(Riposte.HANDLER_TYPE_TRANSLATE, HANDLER_METHOD_TRANSLATE);

    this.state = {
        "expressPreMiddlewareEnabled": false,
        "expressPostMiddlewareEnabled": false
    };

    return this;
  }

  use(type, method) {
    this.handlers[type] = method;
    return this;
  }

  static get HANDLER_TYPE_400() { return "400" }
  static get HANDLER_TYPE_401() { return "401" }
  static get HANDLER_TYPE_403() { return "401" }
  static get HANDLER_TYPE_404() { return "404" }
  static get HANDLER_TYPE_500() { return "500" }
  static get HANDLER_TYPE_CREATE_ERROR() { return "error" }
  static get HANDLER_TYPE_ERROR_TO_OBJECT() { return "errorToObject" }
  static get HANDLER_TYPE_SANITIZE() { return "sanitize" }
  static get HANDLER_TYPE_TRANSLATE() { return "translate" }

}

util.inherits(Riposte, EventEmitter);


/* ************************************************** *
 * ******************** Require Other Classes
 * ************************************************** */

let Reply = (require('./reply.js'))(Riposte);


/* ************************************************** *
 * ******************** Default Handler Methods
 * ************************************************** */

const HANDLER_METHOD_CREATE_ERROR = function(data, options = {}, cb, riposte) {
  let RichError = riposte.get("RichError");
  if(RichError) {
    if(data instanceof RichError) {
      cb(undefined, data);
    } else {
      cb(undefined, new RichError(data, options));
    }
  } else if(data instanceof Error) {
    if(options.statusCode) {
      data.statusCode = options.statusCode;
    }
    cb(undefined, data);
  } else {
    let error = new Error(data);
    if(options.statusCode) {
      error.statusCode = options.statusCode;
    }
    cb(undefined, error);
  }
};

const HANDLER_METHOD_ERROR_TO_OBJECT = function(data, options = {}, cb, riposte) {
  let RichError = riposte.get("RichError");
  if(RichError && data instanceof RichError) {
      cb(undefined, data.toResponseObject(riposte.get('richErrorOptions')), data.get("statusCode"));
  } else if(data instanceof Error) {
    let obj = {
      message: data.message
    };
    if(data.code) {
      obj.code = data.code;
    }
    cb(undefined, obj, options.statusCode || 500);
  } else {
    cb(undefined, data, options.statusCode || 500);
  }
};

const HANDLER_METHOD_400 = function(data, options = {}, cb, riposte) {
  let RichError = riposte.get("RichError");
  if(RichError) {
    data = 'server.400.badRequest';
  } else {
    data = "Bad Request";
    options.statusCode = 400;
  }
  riposte.handle(Riposte.HANDLER_TYPE_CREATE_ERROR, data, options, cb);
};

const HANDLER_METHOD_401 = function(data, options = {}, cb, riposte) {
  let RichError = riposte.get("RichError");
  if(RichError) {
    data = 'server.400.unauthorized';
  } else {
    data = "Unauthorized";
    options.statusCode = 401;
  }
  riposte.handle(Riposte.HANDLER_TYPE_CREATE_ERROR, data, options, cb);
};

const HANDLER_METHOD_403 = function(data, options = {}, cb, riposte) {
  let RichError = riposte.get("RichError");
  if(RichError) {
    data = 'server.403.forbidden';
  } else {
    data = "Forbidden";
    options.statusCode = 403;
  }
  riposte.handle(Riposte.HANDLER_TYPE_CREATE_ERROR, data, options, cb);
};

const HANDLER_METHOD_404 = function(data, options = {}, cb, riposte) {
  let RichError = riposte.get("RichError");
  if(RichError) {
    data = 'server.400.notFound';
  } else {
    data = "Not Found";
    options.statusCode = 404;
  }
  riposte.handle(Riposte.HANDLER_TYPE_CREATE_ERROR, data, options, cb);
};

const HANDLER_METHOD_500 = function (data, options = {}, cb, riposte) {
  let RichError = riposte.get("RichError");
  if(RichError) {
    data = 'server.500.generic';
  } else {
    data = "An internal server error has occurred.";
    options.statusCode = 500;
  }
  riposte.handle(Riposte.HANDLER_TYPE_CREATE_ERROR, data, options, cb);
};

const HANDLER_METHOD_SANITIZE = function(data, options, cb, riposte) {
  cb(undefined, data);
};

const HANDLER_METHOD_TRANSLATE = function(data, options, cb, riposte) {
  let i18next = riposte.get("i18next");
  if(i18next) {
    cb(undefined, i18next.t(data, options));
  } else {
    cb(undefined, data);
  }
};


/* ************************************************** *
 * ******************** Expose Riposte
 * ************************************************** */

module.exports = Riposte;