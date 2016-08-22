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
    let self = this;
    self.setDefault();
    self.set(options);
    EventEmitter.call(this);
  }

  // Create a new reply instance.
  createReply(obj) {
    obj.riposte = obj.riposte || this;
    return new Reply(obj);
  }

  
  addExpressPreMiddleware(app) {
    let self = this;

    // Create and store a new reply for each request made.
    app.use(function (req, res, next) {
      if(res) {
        res.reply = new Reply({riposte: self, res: res});

        if (self.logRequests) {
          switch (req.method) {
            case "POST":
            case "PUT":
              self.handle(Riposte.ON_LOG, ['[%s] ' + req.method + ' ' + req.protocol + '://' + req.get('host') + req.originalUrl + '\n\nHeaders: %s\n\nBody: %s', res.reply.id, JSON.stringify(req.headers, undefined, 2), JSON.stringify(req.body, undefined, 2)]);
              break;
            default:
              self.handle(Riposte.ON_LOG, ['[%s] ' + req.method + ' ' + req.protocol + '://' + req.get('host') + req.originalUrl, res.reply.id]);
              break;
          }
        }
      }
      next();
    });

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
            if(self.logReplies) {
              self.handle(Riposte.ON_LOG, ['[%s] Reply with Status Code: %s\nResponse Body: %s', obj.id, status, JSON.stringify(obj, undefined, 2)]);
            }
            res.status(status).send(obj);
          }
        });
      } else {
        next(new Error("You must call \"riposte.addExpressPreMiddleware(app)\" before \"riposte.addExpressPostMiddleware(app)\"."));
      }
    });

    app.use(function (err, req, res, next) {
      if(err) {
        self.handle(Riposte.ON_REPLY_ERROR, err, res.replyOptions, function (err, data) {
          if(err) {
            self.handle(Riposte.ON_LOG, err, { level: "error" });
          }

          if(self.logReplies) {
            self.handle(Riposte.ON_LOG, ['[%s] Reply with Status Code: 500\nResponse Body: %s', data.id, JSON.stringify(data, undefined, 2)], { level: self.logReplies });
          }

          res.status(500).send(data);
        });
      } else {
        self.handle(Riposte.SET_REPLY_SERVER_ERROR, 500, undefined, function (err, data) {
          if (err) {
            self.handle(Riposte.ON_LOG, err, { level: "error" });
          }

          if (self.logReplies) {
            self.handle(Riposte.ON_LOG, ['[%s] Reply with Status Code: 500\nResponse Body: %s', data.id, JSON.stringify(data, undefined, 2)], { level: self.logReplies });
          }

          res.status(500).send(data);
        });
      }
    });

    return app;
  }
  
  get(key) {
    return this[key];
  }

  handle(event, data, options, cb) {
    this.emit(event, data, options);
    if(this.handlers[event]) {
      this.handlers[event](data, options, cb, this);
    }
    return this;
  }

  onLog(data, options = {}) {
    if(this.log && data) {
      let method = this.log[options.level || "info"];
      method.apply(this.log, data);
    }
  };

  onReplyError(data, options = {}, cb, riposte) {
    let self = riposte || this;
    let RichError = self.get("RichError");
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

  onReplyErrorToObject(data, options = {}, cb, riposte) {
    let self = riposte || this;

    let RichError = self.get("RichError");
    if(RichError && data instanceof RichError) {
      // TODO: Update this based on Rich Error library.
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
  }

  setReplyClientError(statusCode, options = {}, cb, riposte) {
    let self = riposte || this,
      RichError = self.get("RichError");

    options.statusCode = Number(statusCode);
    switch(options.statusCode) {
      case 400: return self.handle(Riposte.ON_REPLY_ERROR, (RichError) ? 'server.400.badRequest' : 'Bad Request', options, cb);
      case 401: return self.handle(Riposte.ON_REPLY_ERROR, (RichError) ? 'server.400.unauthorized' : 'Unauthorized', options, cb);
      case 402: return self.handle(Riposte.ON_REPLY_ERROR, (RichError) ? 'server.400.paymentRequired' : 'Payment Required', options, cb);
      case 403: return self.handle(Riposte.ON_REPLY_ERROR, (RichError) ? 'server.400.forbidden' : 'Forbidden', options, cb);
      case 404: return self.handle(Riposte.ON_REPLY_ERROR, (RichError) ? 'server.400.notFound' : 'Not Found', options, cb);
      case 409: return self.handle(Riposte.ON_REPLY_ERROR, (RichError) ? 'server.400.conflict' : 'Conflict', options, cb);
      default:
        self.handle(Riposte.ON_LOG, ["setReplyClientError():  Unhandled status code of %s", options.statusCode]);
        return self.handle(Riposte.ON_REPLY_ERROR, (RichError) ? 'server.500.generic' : 'An internal server error has occurred.', options, cb);
    }
  }

  setReplyRedirection(statusCode, options = {}, cb, riposte) {
    let self = riposte || this,
      RichError = self.get("RichError");

    options.statusCode = Number(statusCode);
    switch(options.statusCode) {
      case 300: return self.handle(Riposte.ON_REPLY_ERROR, (RichError) ? 'server.300.multipleChoices' : 'Multiple Choices', options, cb);
      case 301: return self.handle(Riposte.ON_REPLY_ERROR, (RichError) ? 'server.301.movedPermanently' : 'Moved Permanently', options, cb);
      case 302: return self.handle(Riposte.ON_REPLY_ERROR, (RichError) ? 'server.302.found' : 'Found', options, cb);
      case 304: return self.handle(Riposte.ON_REPLY_ERROR, (RichError) ? 'server.304.notModified' : 'Not Modified', options, cb);
      case 305: return self.handle(Riposte.ON_REPLY_ERROR, (RichError) ? 'server.305.useProxy' : 'Use Proxy', options, cb);
      case 307: return self.handle(Riposte.ON_REPLY_ERROR, (RichError) ? 'server.307.temporaryRedirect' : 'Temporary Redirect', options, cb);
      case 308: return self.handle(Riposte.ON_REPLY_ERROR, (RichError) ? 'server.308.permanentRedirect' : 'Permanent Redirect', options, cb);
      default:
        self.handle(Riposte.ON_LOG, ["setReplyClientError():  Unhandled status code of %s", options.statusCode]);
        return self.handle(Riposte.ON_REPLY_ERROR, (RichError) ? 'server.500.generic' : 'An internal server error has occurred.', options, cb);
    }
  }

  setReplyServerError(statusCode, options = {}, cb, riposte) {
    let self = riposte || this,
      RichError = self.get("RichError");

    options.statusCode = Number(statusCode);
    switch(options.statusCode) {
      case 500: return self.handle(Riposte.ON_REPLY_ERROR, (RichError) ? 'server.500.generic' : 'An internal server error has occurred.', options, cb);
      default:
        self.handle(Riposte.ON_LOG, ["setReplyClientError():  Unhandled status code of %s", options.statusCode]);
        return self.handle(Riposte.ON_REPLY_ERROR, (RichError) ? 'server.500.generic' : 'An internal server error has occurred.', options, cb);
    }
  }

  setReplySuccess(statusCode, options = {}, cb, riposte) {
    let self = riposte || this,
      RichError = self.get("RichError");

    options.statusCode = Number(statusCode);
    switch(options.statusCode) {
      case 200:
        return cb(undefined, true);
      default:
        self.handle(Riposte.ON_LOG, ["setReplyClientError():  Unhandled status code of %s", options.statusCode]);
        return self.handle(Riposte.ON_REPLY_ERROR, (RichError) ? 'server.500.generic' : 'An internal server error has occurred.', options, cb);
    }
  }

  onSanitizeData(data, options = {}, cb, riposte) {
    cb(undefined, data);
  }

  onTranslate(data, options = {}, cb, riposte) {
    let self = riposte || self;

    let i18next = self.get("i18next");
    if(i18next) {
      cb(undefined, i18next.t(data, options));
    } else {
      cb(undefined, data);
    }
  }

  set(options = {}) {
    for(let key in options) {
      if(options.hasOwnProperty(key)) {
        switch(key) {
          case "i18next":
          case "log":
          case "logReplies":
          case "logRequests":
          case "richErrorOptions":
            this[key] = options[key];
            break;
          default:  // Unsupported option(s).
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

    // Add event listeners.
    this.on(Riposte.ON_LOG, this.onLog);

    // Add default handlers.
    this.handlers = {};
    this.use(Riposte.ON_REPLY_ERROR, this.onReplyError);
    this.use(Riposte.ON_REPLY_ERROR_TO_OBJECT, this.onReplyErrorToObject);
    this.use(Riposte.ON_SANITIZE_DATA, this.onSanitizeData);
    this.use(Riposte.ON_TRANSLATE, this.onTranslate);
    this.use(Riposte.SET_REPLY_CLIENT_ERROR, this.setReplyClientError);
    this.use(Riposte.SET_REPLY_REDIRECTION, this.setReplyRedirection);
    this.use(Riposte.SET_REPLY_SERVER_ERROR, this.setReplyServerError);
    this.use(Riposte.SET_REPLY_SUCCESS, this.setReplySuccess);

    return this;
  }

  use(type, method) {
    this.handlers[type] = method;
    return this;
  }

  /* ************************************************** *
   * ******************** Handler Types
   * ************************************************** */

  // Handler called whenever an error occurs.
  static get ON_LOG() { return "log" }
  static get ON_REPLY_ERROR() { return "reply-error" }
  static get ON_REPLY_ERROR_TO_OBJECT() { return "reply-error-to-object" }
  static get ON_SANITIZE_DATA() { return "sanitize-data" }
  static get ON_TRANSLATE() { return "translate" }
  static get SET_REPLY_CLIENT_ERROR() { return "client-error" }
  static get SET_REPLY_REDIRECTION() { return "set-reply-redirection"}
  static get SET_REPLY_SERVER_ERROR() { return "server-error" }
  static get SET_REPLY_SUCCESS() { return "set-reply-ok"}


}

util.inherits(Riposte, EventEmitter);


/* ************************************************** *
 * ******************** Require Other Classes
 * ************************************************** */

let Reply = (require('./reply.js'))(Riposte);


/* ************************************************** *
 * ******************** Expose Riposte
 * ************************************************** */

module.exports = Riposte;