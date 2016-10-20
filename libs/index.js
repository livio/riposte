/* ************************************************** *
 * ******************** Node Modules
 * ************************************************** */

let async = require('async'),
  EventEmitter = require('events'),
  path = require('path'),
  Remie = require('remie'),
  util = require('util');


/* ************************************************** *
 * ******************** Helper Methods
 * ************************************************** */

/**
 * Convert the Reply instance to an object, then send
 * it to the callback method provided.
 */
let sendToCallback = function(reply, replyToObjectOptions, cb, riposte) {
  if(reply) {
    reply.toObject(replyToObjectOptions, function (err, obj) {
      riposte.logError(err);
      riposte.logReply(obj);
      cb(err, obj);
    });
  } else {
    console.log("TODO:  Is this a valid use-case or should it throw an error.");
    riposte.logReply(reply);
    cb(undefined, reply);
  }
  return riposte;
};

/**
 * Find the Reply instance in the express response object
 * and convert it to an object.  Then move the HTTP status
 * code to the header and send the response to the client.
 */
let sendToExpress = function(res, replyToObjectOptions, cb, riposte) {
  if(res) {
    if(res.reply) {
      res.reply.toObject(replyToObjectOptions || res.replyToObjectOptions, function (err, obj) {
        if (err) {
          riposte.logError(err);
          cb(err);
        } else {
          riposte.logReply(obj);

          let httpStatusCode = obj.httpStatusCode;
          delete obj.httpStatusCode;

          res.status(httpStatusCode).send(obj);
        }
      });
    } else {
      cb(new Error("Riposte:  Express response object passed to send() is missing the riposte reply object.  Did you forget to call addExpressPreMiddleware(app) before addExpressPostMiddlware(app)?"));
    }
  } else {
    cb(new Error("Riposte:  The response object passed to send() is invalid."));
  }
  return riposte;
};

/**
 * Add one or more errors to an instance of Reply.
 * Then send the reply to the client.
 */
let addErrorsToReplyAndSend = function(errors, reply, replyToObjectOptions, cb, riposte) {
  // Check if reply is actually an express response object in hiding!
  if(reply && ! (reply instanceof Reply) && (reply.reply instanceof Reply)) {
    // If that little fucker is an express response object then we need to extract the reply out of it.
    reply = reply.reply;
  }

  // Now make sure reply is defined, otherwise create a new one.
  if( ! reply) {
    reply = riposte.createReply();
  }

  if(err) {
    reply.addErrors(err, function (err) {
      if (err) {
        cb(err);
      } else {
        riposte.send(reply, replyToObjectOptions, cb);
      }
    });
  } else {
    riposte.send(reply, replyToObjectOptions, cb);
  }
};


/* ************************************************** *
 * ******************** Riposte Class
 * ************************************************** */

class Riposte {
  constructor(options) {
    this.setDefault();
    this.set(options);
    EventEmitter.call(this);
    return this;
  }

  addExpressPreMiddleware(app) {
    let self = this;

    // Create and store a new reply for each request made.
    app.use(function (req, res, next) {
      if(res) {
        res.reply = self.createReply({ res: res});
        self.logRequest(req, res);
      }
      next();
    });

    return app;
  }

  addExpressPostMiddleware(app) {
    let self = this;

    // Send the reply stored in the response object
    app.use(function (req, res, next) {
      self.send(res, next);
    });

    // Add the error that occurred to the reply in the
    // response object, then send the reply.
    app.use(function (err, req, res, next) {
      if( ! err) {
        throw new Error("Riposte:  The Express error handler route added by riposte was just called with an invalid error object.");
      } else {
        addErrorsToReplyAndSend(err, res, undefined, next, self);
      }
    });

    return app;
  }

  createReply(obj = {}) {
    obj.riposte = obj.riposte || this;
    //TODO: Define configurable default reply options here.
    return new Reply(obj);
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

  /**
   * Default handler to create an error that will be
   * included in a Reply's error attribute.
   */
  handleCreateError(data, options = {}, cb, riposte) {
    let self = riposte || this,
      remie = self.get("remie");

    if(remie) {
      if(data instanceof remie.RichError) {
        // Data is already a Remie error, pass it along.
        cb(undefined, data);
      } else {
        // Create a new Remie error from the data.
        cb(undefined, remie.create(data, options));
      }
    } else if(data instanceof Error) {
      // Data is a Node.js error.  Add the HTTP status code if present.
      if(options.httpStatusCode) {
        data.httpStatusCode = options.httpStatusCode;
      }
      cb(undefined, data);
    } else {
      // Data is probably a string, create a new Node.js error out of it.
      let error = new Error(data);

      // Add the HTTP status code if present.
      if(options.httpStatusCode) {
        error.httpStatusCode = options.httpStatusCode;
      }
      cb(undefined, error);
    }
  };

  /**
   * Default handler to convert an error in a Reply
   * instance into an object.
   */
  handleErrorToObject(data, options, cb, riposte) {
    let self = riposte || this,
      remie = self.get("remie");

    if(remie && data instanceof remie.RichError) {
      cb(undefined, data.sanitize());
    } else {
      data.httpStatusCode = options.httpStatusCode || data.httpStatusCode || 500;

      if(data instanceof Error) {
        let obj = {
          httpStatusCode: data.httpStatusCode,
          message: data.message,
          stack: data.stack
        };
        if(data.code) {
          obj.code = data.code;
        }
        cb(undefined, obj);
      } else {
        cb(undefined, data);
      }
    }
  }

  handleCreateClientError(httpStatusCode, options = {}, cb, riposte) {
    let self = riposte || this,
      remie = self.get("i18next");

    options.httpStatusCode = Number(httpStatusCode);
    switch(options.httpStatusCode) {
      case 400: return self.handle(Riposte.HANDLE_CREATE_ERROR, (remie) ? 'server.400.badRequest' : 'Bad Request', options, cb);
      case 401: return self.handle(Riposte.HANDLE_CREATE_ERROR, (remie) ? 'server.400.unauthorized' : 'Unauthorized', options, cb);
      case 402: return self.handle(Riposte.HANDLE_CREATE_ERROR, (remie) ? 'server.400.paymentRequired' : 'Payment Required', options, cb);
      case 403: return self.handle(Riposte.HANDLE_CREATE_ERROR, (remie) ? 'server.400.forbidden' : 'Forbidden', options, cb);
      case 404: return self.handle(Riposte.HANDLE_CREATE_ERROR, (remie) ? 'server.400.notfound' : 'Not Found', options, cb);
      case 409: return self.handle(Riposte.HANDLE_CREATE_ERROR, (remie) ? 'server.400.conflict' : 'Conflict', options, cb);
      default:
        self.handle(Riposte.ON_LOG, ["setReplyClientError():  Unhandled status code of %s", options.httpStatusCode]);
        return self.handle(Riposte.HANDLE_CREATE_ERROR, (i18next) ? 'server.500.generic' : 'An internal server error has occurred.', options, cb);
    }
  }

  handleCreateOk(httpStatusCode, options = {}, cb, riposte) {
    let self = riposte || this,
      remie = self.get("remie");

    options.httpStatusCode = Number(httpStatusCode);
    switch(options.httpStatusCode) {
      case 200:
        return cb(undefined, true);
      default:
        self.handle(Riposte.ON_LOG, ["setReplyClientError():  Unhandled status code of %s", options.httpStatusCode]);
        return self.handle(Riposte.HANDLE_CREATE_ERROR, (i18next) ? 'server.500.generic' : 'An internal server error has occurred.', options, cb);
    }
  }

  handleCreateRedirectionError(httpStatusCode, options = {}, cb, riposte) {
    let self = riposte || this,
      remie = self.get("remie");

    options.httpStatusCode = Number(httpStatusCode);
    switch(options.httpStatusCode) {
      case 300: return self.handle(Riposte.HANDLE_CREATE_ERROR, (i18next) ? 'server.300.multipleChoices' : 'Multiple Choices', options, cb);
      case 301: return self.handle(Riposte.HANDLE_CREATE_ERROR, (i18next) ? 'server.301.movedPermanently' : 'Moved Permanently', options, cb);
      case 302: return self.handle(Riposte.HANDLE_CREATE_ERROR, (i18next) ? 'server.302.found' : 'Found', options, cb);
      case 304: return self.handle(Riposte.HANDLE_CREATE_ERROR, (i18next) ? 'server.304.notModified' : 'Not Modified', options, cb);
      case 305: return self.handle(Riposte.HANDLE_CREATE_ERROR, (i18next) ? 'server.305.useProxy' : 'Use Proxy', options, cb);
      case 307: return self.handle(Riposte.HANDLE_CREATE_ERROR, (i18next) ? 'server.307.temporaryRedirect' : 'Temporary Redirect', options, cb);
      case 308: return self.handle(Riposte.HANDLE_CREATE_ERROR, (i18next) ? 'server.308.permanentRedirect' : 'Permanent Redirect', options, cb);
      default:
        self.handle(Riposte.ON_LOG, ["setReplyClientError():  Unhandled status code of %s", options.httpStatusCode]);
        return self.handle(Riposte.HANDLE_CREATE_ERROR, (i18next) ? 'server.500.generic' : 'An internal server error has occurred.', options, cb);
    }
  }

  handleCreateServerError(httpStatusCode, options = {}, cb, riposte) {
    let self = riposte || this,
      remie = self.get("remie");

    options.httpStatusCode = Number(httpStatusCode);
    switch(options.httpStatusCode) {
      case 500: return self.handle(Riposte.HANDLE_CREATE_ERROR, (i18next) ? 'server.500.generic' : 'An internal server error has occurred.', options, cb);
      default:
        self.handle(Riposte.ON_LOG, ["setReplyClientError():  Unhandled status code of %s", options.httpStatusCode]);
        return self.handle(Riposte.HANDLE_CREATE_ERROR, (i18next) ? 'server.500.generic' : 'An internal server error has occurred.', options, cb);
    }
  }

  handleSanitizeReplyData(data, options = {}, cb, riposte) {
    cb(undefined, data);
  }

  handleTranslation(data, options = {}, cb, riposte) {
    let self = riposte || self;

    let i18next = self.get("i18next");
    if(i18next) {
      cb(undefined, i18next.t(data, options));
    } else {
      cb(undefined, data);
    }
  }

  logError(err) {
    if(err && this.logErrorLevel) {
      this.handle(Riposte.ON_LOG, [err], { level: this.logErrorLevel });
    }
  }

  logReply(obj) {
    if(this.logReplyLevel) {
      if(obj) {
        this.handle(Riposte.ON_LOG, ['[%s] Reply with Status Code: %s\nBody: %s', obj.id, obj.httpStatusCode, JSON.stringify(obj, undefined, 2)], { level: this.logReplyLevel });
      } else {
        this.handle(Riposte.ON_LOG, ['[undefined] Reply with Status Code: undefined\nBody: undefined'], { level: this.logReplyLevel });
      }
    }
  }

  logRequest(req, res) {
    if (this.logRequestLevel) {
      let id = (res && res.reply && res.reply.id) ? res.reply.id : undefined;

      if(req) {
        switch (req.method) {
          //TODO: Make sure all HTTP methods are handled here.
          case "POST":
          case "PUT":
            this.handle(Riposte.ON_LOG, ['[%s] %s %s://%s%s\n\nHeaders: %s\n\nBody: %s', id, req.method, req.protocol, req.get('host'), req.originalUrl, JSON.stringify(req.headers, undefined, 2), JSON.stringify(req.body, undefined, 2)], { level: this.logRequestLevel });
            break;
          default:
            this.handle(Riposte.ON_LOG, ['[%s] %s %s://%s%s', id, req.method, req.protocol, req.get('host'), req.originalUrl], { level: this.logRequestLevel });
            break;
        }
      } else {
        this.handle(Riposte.ON_LOG, ['[%s] undefined\n\nHeaders: undefined\n\nBody: undefined', id], { level: this.logRequestLevel });
      }
    }
  }

  onLog(data, options = {}) {
    if(data) {
      if(this.log) {
        //TODO: Confirm options handles any other available bunyan options for log.method
        let method = this.log[options.level || "info"];
        method.apply(this.log, data);
      } else {
        console.log.apply(console, data);
      }
    }
  };

  send(reply, replyToObjectOptions, cb) {
    if(reply instanceof Reply) {
      sendToCallback(reply, replyToObjectOptions, cb, this);
    } else {
      sendToExpress(reply, replyToObjectOptions, cb, this);
    }
    return this;
  }

  set(options = {}) {
    for(let key in options) {
      if(options.hasOwnProperty(key)) {
        switch(key) {
          case "log":
          case "logErrorLevel":
          case "logRequestLevel":
          case "logReplyLevel":
            this[key] = options[key];
            break;
          default:  // Unsupported option(s).
            break;
        }
      }
    }

    if()

    if(options["remieOptions"] !== undefined) {
      this["remieOptions"] = options["remieOptions"];
    } else {
      this["remieOptions"] = { i18next: this["i18next"] };
    }

    //TODO: Option to disable remie.
    if(options["remie"] !== undefined) {
      this["remie"] = options["remie"];
    } else {
      this["remie"] = new Remie(this["remieOptions"]);
    }

    return this;
  }

  setDefault() {
    // Log instance should be undefined to force console logging.
    this.log = undefined;

    // Errors should be logged as error messages.
    this.logErrorLevel = 'error';

    // Requests are logged as trace messages.
    this.logRequestLevel = 'trace';

    // Replies should be logged at the same level as requests.
    this.logReplyLevel = this.logRequestLevel;

    // Options used to configure the local Remie instance.
    this.remieOptions = {};

    // Create a new Remie instance with the default settings.
    this.remie = new Remie(this.remieOptions);

    // Add event listener called when a message should be logged.
    this.on(Riposte.ON_LOG, this.onLog);

    // Clear out all existing handlers.
    this.handlers = {};

    // Add handler to create client errors, i.e. errors with a 400 HTTP status code.
    this.use(Riposte.HANDLE_CREATE_CLIENT_ERROR, this.handleCreateClientError);

    // Add handler to create an error.
    this.use(Riposte.HANDLE_CREATE_ERROR, this.handleCreateError);

    //?
    this.use(Riposte.HANDLE_CREATE_OK, this.handleCreateOk);

    // Add handler to create redirection errors, i.e. errors with a 300 HTTP status code.
    this.use(Riposte.HANDLE_CREATE_REDIRECTION_ERROR, this.handleCreateRedirectionError);

    // Add handler to create server errors, i.e. errors with a 500 HTTP status code.
    this.use(Riposte.HANDLE_CREATE_SERVER_ERROR, this.handleCreateServerError);

    // Add handler to convert an error in a reply to an object.
    this.use(Riposte.HANDLE_ERROR_TO_OBJECT, this.handleErrorToObject);

    // Add handler to sanitize the data portion of a reply.
    this.use(Riposte.HANDLE_SANITIZE_REPLY_DATA, this.handleSanitizeReplyData);

    // Add handler to translate a locale into a string.
    this.use(Riposte.HANDLE_TRANSLATION, this.handleTranslation);

    return this;
  }

  use(type, method) {
    this.handlers[type] = method;
    return this;
  }


  /* ************************************************** *
   * ******************** Handler & Event Types
   * ************************************************** */

  // Event Types, begin with "on"
  static get ON_LOG() { return "on-log" }

  // Handler Types, begin with "handle"
  static get HANDLE_CREATE_ERROR() { return "handle-create-error" }
  static get HANDLE_ERROR_TO_OBJECT() { return "handle-error-to-object" }
  static get HANDLE_SANITIZE_REPLY_DATA() { return "handle-sanitize-reply-data" }
  static get HANDLE_TRANSLATION() { return "handle-translation" }
  static get HANDLE_CREATE_CLIENT_ERROR() { return "handle-create-client-error" }
  static get HANDLE_CREATE_REDIRECTION_ERROR() { return "handle-create-redirection-error"}
  static get HANDLE_CREATE_SERVER_ERROR() { return "handle-create-server-error" }
  static get HANDLE_CREATE_OK() { return "handle-create-ok"}
  
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