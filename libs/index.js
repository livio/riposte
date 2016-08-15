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
      res.reply = new Reply(undefined, self);
      next();
    });
  }

  addExpressPostMiddleware(app) {
    let self = this;
    app.use(function (req, res, next) {
      if(res && res.reply) {
        res.reply.toObject(res.replyOptions, function (err, obj, status) {
          if (err) {
            next(err);
          } else {
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
            res.status(500).send(new Error("An internal server error has occurred."));
          } else {
            res.status(500).send(errorObject);
          }

        });
      }
    });

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
        switch(options) {
          case "i18next":
          case "log":
          case "richErrorOptions":
            this[key] = options[key];
            break;
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

const HANDLER_METHOD_CREATE_ERROR = function(data, options, cb, riposte) {
  let RichError = riposte.get("RichError");
  if(RichError) {
    if(data instanceof RichError) {
      cb(undefined, data);
    } else {
      cb(undefined, new RichError(data, options));
    }
  } else if(data instanceof Error) {
    cb(undefined, data);
  } else {
    cb(undefined, new Error(data));
  }
};

const HANDLER_METHOD_ERROR_TO_OBJECT = function(data, options, cb, riposte) {
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
    cb(undefined, obj, 500);
  } else {
    cb(undefined, data, 500);
  }
};

const HANDLER_METHOD_400 = function(data, options, cb, riposte) {
  let RichError = riposte.get("RichError");
  if(RichError) {
    data = 'server.400.badRequest';
  } else {
    data = "Bad Request";
  }
  riposte.handle(Riposte.HANDLER_TYPE_CREATE_ERROR, data, options, cb);
};

const HANDLER_METHOD_401 = function(data, options, cb, riposte) {
  let RichError = riposte.get("RichError");
  if(RichError) {
    data = 'server.400.unauthorized';
  } else {
    data = "Unauthorized";
  }
  riposte.handle(Riposte.HANDLER_TYPE_CREATE_ERROR, data, options, cb);
};

const HANDLER_METHOD_403 = function(data, options, cb, riposte) {
  let RichError = riposte.get("RichError");
  if(RichError) {
    data = 'server.403.forbidden';
  } else {
    data = "Forbidden";
  }
  riposte.handle(Riposte.HANDLER_TYPE_CREATE_ERROR, data, options, cb);
};

const HANDLER_METHOD_404 = function(data, options, cb, riposte) {
  let RichError = riposte.get("RichError");
  if(RichError) {
    data = 'server.400.notFound';
  } else {
    data = "Not Found";
  }
  riposte.handle(Riposte.HANDLER_TYPE_CREATE_ERROR, data, options, cb);
};

const HANDLER_METHOD_500 = function (data, options, cb, riposte) {
  let RichError = riposte.get("RichError");
  if(RichError) {
    data = 'server.500.generic';
  } else {
    data = "An internal server error has occurred.";
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