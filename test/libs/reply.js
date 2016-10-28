// When enabled, additional debug messages will be displayed.
const DEBUG = process.env.DEBUG || false;

// Require npm modules.
let assert = require('chai').assert,
  expect = require('chai').expect,
  i18next = require('i18next'),
  path = require("path"),
  waterfall = require('async/waterfall');

// Require local modules.
let Riposte = (require("../../libs/index.js")),
  Reply = require("../../libs/reply.js");


// Current instance of riposte.
let riposte;


/* ************************************************** *
 * ******************** i18next Configurations
 * ************************************************** */

// Configure i18next to handle translations of a few common errors.  See http://i18next.com/
i18next.init({
  lng: "en-US",
  nsSeparator: false,
  resources: {
    en: {
      translation: {
        "server" : {
          "400" : {
            "notfound": "The page {{- page}} could not be found",   //There is a '-' before page because the value is unescaped.  See http://i18next.com/translate/interpolation/
            "forbidden": "The page is forbidden",
            "unauthorized": "You are not authorized to access this page"
          }
        }
      }
    }
  }
});

// Gets the expected HTTP status code from the i18next locale string.
let getStatusCodeFromLocale = function(locale) {
  switch(locale) {
    case "server.400.notfound":     return 404;
    case "server.400.forbidden":    return 403;
    case "server.400.unauthorized": return 401;
    default:
      throw new Error("Locale "+ locale + " is invalid.");
  }
};


/* ************************************************** *
 * ******************** Global Test Methods
 * ************************************************** */

let validateReply = function(reply, options, cb) {
  let tasks = [];

  tasks.push(function(next) {
    validateReplyInstance(reply, next);
  });

  tasks.push(function(next) {
    validateOptions(reply, options, next);
  });

  tasks.push(function(next) {
    validateToObject(reply, options, next);
  });

  waterfall(tasks, cb);
};

let validateReplyInstance = function(reply, next) {

};





let validateSanitizedError = function (errorInstance, error, errorType, errorOptions = {}, sanitizeOptions = {}, cb) {
  let tasks = [];

  tasks.push(function (next) {
    if( ! errorOptions.error) {
      errorOptions.error = {};
    }
    errorOptions.error.stack = errorInstance.error.stack;
    createExpectedError(error, errorType, errorOptions, next);
  });

  tasks.push(function (expectedError, next) {
    createExpectedSanitizedError(expectedError, sanitizeOptions, next);
  });

  tasks.push(function (expectedSanitizedError, next) {
    compareSanitizedError(errorInstance, expectedSanitizedError, sanitizeOptions, next);
  });

  waterfall(tasks, cb);
};

/**
 * Validate a Remie error instance to ensure it has
 * the correct properties and methods.
 * @param e is a Remie error instance.
 * @param cb is a callback method.
 */
let validateErrorInstance = function(e, cb) {
  // The instance should be defined, a Rich Error instance, and an object type.
  expect(e).to.exist;
  expect(e).to.be.an.instanceOf(RichError);
  expect(e).to.be.a('object');

  // Error object should be defined... and an error object.
  expect(e.error).to.exist;
  expect(e.error).to.be.a('error');

  // Error message should be defined and a string.
  expect(e.error.message).to.exist;
  expect(e.error.message).to.be.a('string');

  // Error stack should be defined and a string.
  expect(e.error.stack).to.exist;
  expect(e.error.stack).to.be.a('string');

  // Internal Only should be a defined boolean.
  expect(e.internalOnly).to.exist;
  expect(e.internalOnly).to.be.a('boolean');

  // Level should be defined and a string.
  expect(e.level).to.exist;
  expect(e.level).to.be.a('string');

  // Status code should be defined and a number from 100 - 599 (inclusive)
  expect(e.httpStatusCode).to.exist;
  expect(e.httpStatusCode).to.be.a('number');
  expect(e.httpStatusCode).to.be.at.least(100);
  expect(e.httpStatusCode).to.be.below(600);

  // Begin Optional fields

  // If defined, message data should be an object.
  if(e.messageData) {
    expect(e.messageData).to.be.a('object');
  }

  // If defined, reference data should be an object.
  if(e.referenceData) {
    expect(e.referenceData).to.be.a('object');
  }

  // Sanitize options should be defined and an object.
  if(e.sanitizeOptions) {
    expect(e.sanitizeOptions).to.be.a('object');
  }

  // If defined, internal message should be a string.
  if(e.internalMessage) {
    expect(e.internalMessage).to.be.a('string');
  }

  // If defined, error code should be a string.
  if(e.error.code) {
    expect(e.error.code).to.be.a('string');
  }

  // Check for public methods

  expect(e.build).to.be.a('function');
  expect(e.get).to.be.a('function');
  expect(e.sanitize).to.be.a('function');
  expect(e.set).to.be.a('function');
  expect(e.toObject).to.be.a('function');

  if(cb) {
    cb();
  }
};

/**
 *
 * @param e
 * @param errorType
 * @param options
 * @param cb
 */
let validateErrorDefaults = function(e, errorType, options = {}, cb) {

  // Make sure options.error exists before accessing it.
  if(options.error !== undefined) {
    // If not specified, error code should be undefined.
    if (options.error.code === undefined) {
      expect(e.error.code).to.be.undefined;
    }
  }

  // If not specified, internal only should be false.
  if(options.internalOnly === undefined) {
    expect(e.internalOnly).to.equal(false);
  }

  // If not specified, level should be 'error'.
  if(options.level === undefined) {
    expect(e.level).to.equal('error');
  }

  // If not specified and not of error type locale, the status code should be 500.
  if(options.httpStatusCode === undefined && errorType !== ERROR_TYPE_LOCALE) {
    expect(e.httpStatusCode).to.equal(500);
  }

  if(options.messageData === undefined) {
    expect(e.messageData).to.be.undefined;
  }

  // If not specified, reference data should be undefined.
  if(options.referenceData === undefined) {
    expect(e.referenceData).to.be.undefined;
  }

  // If not specified, internal message should be undefined.
  if(options.internalMessage === undefined) {
    expect(e.internalMessage).to.be.undefined;
  }

  // If not specified, sanitize options should be undefined.
  if(options.sanitizeOptions === undefined) {
    expect(e.sanitizeOptions).to.be.undefined;
  }

  if(cb) {
    cb();
  }
};

let validateToObject = function(e, cb) {
  // TODO: Check for valid and invalid fields.
  let obj = e.toObject();

  // The object should be a defined object and not an instance of Rich Error.
  expect(obj).to.exist;
  expect(obj).to.not.be.an.instanceOf(RichError);
  expect(obj).to.be.a('object');

  // Error should be defined and an error object.
  expect(obj.error).to.exist;
  expect(obj.error).to.be.a('object');

  // Error message should be defined and a string.
  expect(obj.error.message).to.exist;
  expect(obj.error.message).to.be.a('string');

  // Error stack should be defined and a string.
  expect(obj.error.stack).to.exist;
  expect(obj.error.stack).to.be.a('string');

  // Internal Only should be a defined boolean.
  expect(obj.internalOnly).to.exist;
  expect(obj.internalOnly).to.be.a('boolean');

  // Level should be defined and a string.
  expect(obj.level).to.exist;
  expect(obj.level).to.be.a('string');

  // Status code should be defined and a number from 100 - 599 (inclusive)
  expect(obj.httpStatusCode).to.exist;
  expect(obj.httpStatusCode).to.be.a('number');
  expect(obj.httpStatusCode).to.be.at.least(100);
  expect(obj.httpStatusCode).to.be.below(600);

  // Begin Optional fields

  // If defined, message data should be an object.
  if(obj.messageData) {
    expect(obj.messageData).to.be.a('object');
  }

  // If defined, reference data should be an object.
  if(obj.referenceData) {
    expect(obj.referenceData).to.be.a('object');
  }

  if(obj.sanitizeOptions) {
    expect(obj.sanitizeOptions).to.be.a('object');
  }

  // If defined, internal message should be a string.
  if(obj.internalMessage) {
    expect(obj.internalMessage).to.be.a('string');
  }

  // If defined, error code should be a string.
  if(obj.error.code) {
    expect(obj.error.code).to.be.a('string');
  }

  // Ensure public methods are gone.

  expect(obj.build).to.be.undefined;
  expect(obj.get).to.be.undefined;
  expect(obj.sanitize).to.be.undefined;
  expect(obj.set).to.be.undefined;
  expect(obj.toObject).to.be.undefined;

  cb();
};

let createExpectedError = function (error, errorType, options = {}, cb) {
  let e = {
    error: {
      code: undefined
    },
    internalOnly: false,
    level: 'error',
    httpStatusCode: 500
  };

  // Note:  We use a hardcoded type to test Remie's error type detection.
  switch(errorType) {
    case ERROR_TYPE_SYSTEM:
      e.error.message = error.message;
      break;
    case ERROR_TYPE_STRING:
      e.error.message = error;
      break;
    case ERROR_TYPE_LOCALE:
      e.error.message = remie.i18next.t(error, options.messageData);
      e.messageData = options.i18next;
      break;
    case ERROR_TYPE_RICHERROR:
      e.error.message = error.error.message;
      e.error.stack = error.error.stack;
      break;
    default:
      throw new Error("The error type '"+errorType+"' is invalid.");
      break;
  }

  if(options.internalOnly === true) {
    e.internalOnly = options.internalOnly;
  }

  if(options.internalMessage) {
    e.internalMessage = options.internalMessage;
  }

  if(options.level) {
    e.level = options.level;
  }

  if(options.messageData) {
    e.messageData = options.messageData;
  }

  if(options.referenceData) {
    e.referenceData = options.referenceData;
  }

  // Locale errors should have a specific httpStatusCode and code.
  if(errorType === ERROR_TYPE_LOCALE) {
    e.httpStatusCode = getStatusCodeFromLocale(error);
    e.error.code = error;
  }

  if(options.httpStatusCode) {
    e.httpStatusCode = options.httpStatusCode;
  }

  if(options.sanitizeOptions) {
    e.sanitizeOptions = options.sanitizeOptions;
  }

  if(options.error) {
    if (options.error.code) {
      e.error.code = options.error.code;
    }

    if(options.error.stack) {
      e.error.stack = options.error.stack;
    }

    if(options.error.message) {
      e.error.message = options.error.message;
    }
  }

  // Error codes should be lowercase.
  if(e.error.code) {
    e.error.code = e.error.code.toLowerCase();
  }

  if(cb) {
    cb(undefined, e);
  } else {
    return e;
  }
};

let compareErrors = function(actualErrorInstance, expected, options, cb) {
  actual = actualErrorInstance.toObject();

  if(DEBUG) {
    console.log("\n-------------------- compareErrors() --------------------");
    console.log("Actual: %s\n", JSON.stringify(actual, undefined, 2));
    console.log("\nExpected: %s", JSON.stringify(expected, undefined, 2));
    console.log("------------------ / compareErrors() --------------------\n");
  }

  for(var key in expected) {
    switch(key) {
      case 'error':
        for(var subKey in expected[key]) {
          if(expected[key][subKey] !== undefined) {
            if(DEBUG) { console.log('Assert Equal: e.%s.%s --> "%s" === "%s"', key, subKey, actual[key][subKey], expected[key][subKey]); }
            assert.equal(actual[key][subKey], expected[key][subKey]);
          } else {
            if(DEBUG) { console.log('Ignore: e.%s.%s --> actual = "%s"', key, subKey, actual[key][subKey]); }
          }
        }
        break;
      default:
        if(expected[key] !== undefined) {
          if(DEBUG) { console.log('Assert Equal: e.%s --> "%s" === "%s"', key, actual[key], expected[key]); }
          assert.equal(actual[key], expected[key]);
        } else {
          if(DEBUG) { console.log('Ignore: e.%s --> actual = "%s"', key, actual[key]); }
        }
        break;
    }
  }
  if(cb) {
    cb();
  }
};

let createExpectedSanitizedError = function(error, options = {}, cb) {
  let e;

  if(error["internalOnly"] !== true) {
    e = {};

    for (var key in error) {
      if (error.hasOwnProperty(key)) {
        switch (key) {
          case "sanitizeOptions":
          case "internalOnly":
          case "internalMessage":
          default:
            break;

          case "level":
          case "messageData":
          case "referenceData":
          case "httpStatusCode":
            if (options[key] !== false) {
              e[key] = error[key];
            }
            break;

          case "error":
            if (options[key] !== false) {
              if (e[key] === undefined) {
                e[key] = {};
              }

              for (subKey in error[key]) {
                if (error[key].hasOwnProperty(subKey)) {
                  switch (subKey) {
                    case "message":
                    case "code":
                    case "stack":
                      if (options[key] && options[key][subKey] !== false) {
                        if(error[key][subKey] !== undefined) {
                          e[key][subKey] = error[key][subKey];
                        }
                      }
                      break;

                    default:
                      break;
                  }
                }
              }
            }
            break;
        }
      }
    }
  }

  if(cb) {
    cb(undefined, e);
  } else {
    return e;
  }
};

let compareSanitizedError = function (e, expected, options, cb) {
  let obj = e.sanitize(options);

  //console.log("CompareSanitizedError(): Sanitized: %s", JSON.stringify(obj, undefined, 2));
  //console.log("CompareSanitizedError(): Expected: %s", JSON.stringify(expected, undefined, 2));

  if (expected === undefined) {
    expect(obj).to.be.undefined;
  } else {
    // The object should be a defined object and not an instance of Rich Error.
    expect(obj).to.exist;
    expect(obj).to.not.be.an.instanceOf(RichError);
    expect(obj).to.be.a('object');

    // Make sure obj doesn't contain unexpected properties.
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        expect(expected[key]).to.exist;
      }
    }

    // Check each property in obj to make sure it matches the expected.
    for (var key in expected) {
      if (expected.hasOwnProperty(key)) {
        expect(obj[key]).to.exist;

        switch (key) {
          case "internalOnly":
          case "internalMessage":
          case "sanitizeOptions":
          default:
            throw new Error("Unhandled attribute " + key + " in expected value for a sanitized error.");
            break;

          case "httpStatusCode":
            expect(obj[key]).to.be.a('number');
            assert.equal(obj[key], expected[key]);
            break;

          case "level":
            expect(obj[key]).to.be.a('string');
            assert.equal(obj[key], expected[key]);
            break;

          case "messageData":
          case "referenceData":
            expect(obj[key]).to.be.a('object');
            assert.equal(obj[key], expected[key]);
            break;

          case "error":
            expect(expected[key]).to.be.a('object');

            // Error should be defined and an object
            expect(obj[key]).to.exist;
            expect(obj[key]).to.be.a('object');

            for (var subKey in expected[key]) {
              if (expected[key].hasOwnProperty(subKey)) {
                expect(obj[key][subKey]).to.exist;

                switch (subKey) {
                  case "code":
                  case "message":
                  case "stack":
                    expect(obj[key][subKey]).to.be.a('string');
                    assert.equal(obj[key][subKey], expected[key][subKey]);
                    break;

                  default:
                    throw new Error("Unhandled attribute "+ key +"." + subKey + " in expected value for a sanitized error.");
                    break;
                }
              }
            }
            break;
        }
      }
    }

    // Make sure all methods are removed.
    expect(obj.build).to.be.undefined;
    expect(obj.get).to.be.undefined;
    expect(obj.sanitize).to.be.undefined;
    expect(obj.set).to.be.undefined;
    expect(obj.toObject).to.be.undefined;
  }

  if(cb) {
    cb(undefined, obj, expected);
  }
};


/* ************************************************** *
 * ******************** Unit Tests
 * ************************************************** */

describe('Reply', function() {

  beforeEach(function (done) {
    riposte = new Riposte();
    done();
  });

  afterEach(function (done) {
    riposte = undefined;
    done();
  });

  describe('create', function() {

    it('with no options', function (done) {
      let options = undefined,
        reply = new Reply();

      validateReply(reply, options, done);
    });

  });

  describe('create', function() {

    it('from a string literal', function (done) {
      let error = "My error string",
        options = {},
        e = new RichError(error, options, remie);

      validateError(e, error, ERROR_TYPE_STRING, options, done);
    });

  });

  describe('sanitize', function () {

    it("of an error should return a subset of attributes", function (done) {
      let error = "My Test Error",
        options = {},
        sanitizeOptions = {},
        e = new RichError(error, options, remie);

      validateSanitizedError(e, error, ERROR_TYPE_STRING, options, sanitizeOptions, done);
    });

    it("of an internal only error should return undefined", function (done) {
      let error = "My Test Error",
        options = { internalOnly: true },
        sanitizeOptions = {},
        e = new RichError(error, options, remie);

      validateSanitizedError(e, error, ERROR_TYPE_STRING, options, sanitizeOptions, done);
    });

    it("should remove internalMessages", function (done) {
      let error = "My Test Error",
        options = { internalMessage: "this is an internal Message" },
        sanitizeOptions = {},
        e = new RichError(error, options, remie);

      assert.equal(e.internalMessage, options.internalMessage);

      validateSanitizedError(e, error, ERROR_TYPE_STRING, options, sanitizeOptions, function(err, sanitized, expected) {
        expect(sanitized["internalMessage"]).to.be.undefined;
        done(err);
      });
    });

    it("should allow toggling off of sanitize options", function (done) {
      let error = "My Test Error",
        options = { internalMessage: "this is an internal Message" },
        sanitizeOptions = { error: false, level: false, httpStatusCode: false },
        e = new RichError(error, options, remie);

      expect(e["error"]).to.exist;
      expect(e["level"]).to.exist;
      expect(e["httpStatusCode"]).to.exist;

      validateSanitizedError(e, error, ERROR_TYPE_STRING, options, sanitizeOptions, function (err, sanitized, expected) {
        expect(sanitized["error"]).to.be.undefined;
        expect(sanitized["level"]).to.be.undefined;
        expect(sanitized["httpStatusCode"]).to.be.undefined;
        assert.deepEqual(sanitized, {});
        done(err);
      });
    });

    it("should allow toggling on of sanitize options", function (done) {
      let error = "My Test Error",
        options = { internalMessage: "this is an internal Message" },
        sanitizeOptions = { error: { stack: true }},
        e = new RichError(error, options, remie);

      validateSanitizedError(e, error, ERROR_TYPE_STRING, options, sanitizeOptions, function (err, sanitized, expected) {
        done(err);
      });
    });

    it("should handle default sanitize options", function(done) {
      let error = "My Test Error",
        options = { internalMessage: "this is an internal Message" },
        sanitizeOptions = { error: { stack: true }};

      remie = new Remie({
        defaultSanitizeOptions: sanitizeOptions
      });

      let e = new RichError(error, options, remie);

      validateSanitizedError(e, error, ERROR_TYPE_STRING, options, sanitizeOptions, function (err, sanitized, expected) {
        done(err);
      });
    });

  });

  describe('create', function() {

    it("should build a RichError", function(done) {
      let error = "My error string",
        options = {},
        e = remie.create(error, options);

      validateError(e, error, ERROR_TYPE_STRING, options, done);
    });

    it("internal should build an internal only error", function (done) {
      let error = "My Test Error",
        e = remie.createInternal(error, {});

      validateError(e, error, ERROR_TYPE_STRING, { internalOnly: true }, done);
    });

  });

  describe('copy', function () {

    it("should copy an existing error", function (done) {
      let error = "My error string",
        options = {},
        e = remie.create(error, options),
        c = remie.copy(e);

      validateError(e, error, ERROR_TYPE_STRING, options, function(err) {
        if(err) {
          done(err);
        } else {
          validateError(c, error, ERROR_TYPE_STRING, options, function (err) {
            if(err) {
              done(err);
            } else {
              compareErrors(c, e, options, done);
            }
          });
        }
      });
    });

    it("should apply options to a copied error", function (done) {
      let error = "My error string",
        errorOptions = {},
        copyOptions = { internalOnly: true },
        e = remie.create(error, {}),
        c = remie.copy(e, copyOptions);

      validateError(e, error, ERROR_TYPE_STRING, errorOptions, function(err) {
        if(err) {
          done(err);
        } else {

          validateError(c, error, ERROR_TYPE_STRING, copyOptions, function (err) {
            if(err) {
              done(err);
            } else {
              e.internalOnly = true;
              compareErrors(c, e, copyOptions, done);
            }
          });
        }
      });
    });

  });

  describe('static constant', function() {

    it("s for error levels should be strings", function(done) {
      expect(Remie.ERROR_LEVEL_FATAL).to.be.a('string');
      expect(Remie.ERROR_LEVEL_DEBUG).to.be.a('string');
      expect(Remie.ERROR_LEVEL_ERROR).to.be.a('string');
      expect(Remie.ERROR_LEVEL_INFO).to.be.a('string');
      expect(Remie.ERROR_LEVEL_TRACE).to.be.a('string');
      expect(Remie.ERROR_LEVEL_WARN).to.be.a('string');
      done();
    });

    it("s for error levels should have expected values", function(done) {
      expect(Remie.ERROR_LEVEL_FATAL).to.equal("fatal");
      expect(Remie.ERROR_LEVEL_DEBUG).to.equal("debug");
      expect(Remie.ERROR_LEVEL_ERROR).to.equal("error");
      expect(Remie.ERROR_LEVEL_INFO).to.equal("info");
      expect(Remie.ERROR_LEVEL_TRACE).to.equal("trace");
      expect(Remie.ERROR_LEVEL_WARN).to.equal("warn");
      done();
    });

  });

  describe('get', function () {

    it("should return the named attribute's value", function (done) {
      let error = "My error string",
        options = {},
        e = remie.create(error, options);

      expect(e.get("internalOnly")).to.be.a("boolean");
      expect(e.get("internalOnly")).to.equal(false);
      done();
    });

  });

});