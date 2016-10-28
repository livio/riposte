/* ************************************************** *
 * ******************** Require Node Modules
 * ************************************************** */

let express = require('express'),                     // Framework for handling HTTP requests and responses.
  async = require('async'),                           // Utility library for processing data and methods.
  bunyan = require('bunyan'),                         // Logging framework.
  i18next = require('i18next'),                       // Translates string locales into messages in the requested language.
  PrettyStream = require('bunyan-pretty-stream'),     // Streams bunyan logs to the console and makes them look nice.
  request = require("request"),                       // Make Restful calls to APIs.
  Remie = require("remie"),                           // Extends Node.js errors to include rich content and context.
  Riposte = require('../libs/index.js');              // Load the local Riposte module.


/* ************************************************** *
 * ******************** Configure Module Instances
 * ************************************************** */


// Create a new Bunyan logger to print "pretty" logs to the console.
let log = bunyan.createLogger({
  name: "Riposte-Advanced-Example",
  serializers: bunyan.stdSerializers,
  streams: [
    {
      level: 'trace',
      stream: new PrettyStream()
    }
  ]
});

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

// Create a new express application instance.
let app = express();

// Create a new remie instance and configure it.
let remie = new Remie({
  // Exclude a stack trace in errors.
  defaultSanitizeOptions: { error: { stack: false } },

  // Use i18next to translate errors
  i18next: i18next
});


/* ************************************************** *
 * ******************** Configure Riposte
 * ************************************************** */

// Create a new instance of Riposte
let riposte = new Riposte({
  log: log,
  remie: remie
});

// Add a method to sanitize data returned to clients.
// This example method will remove a Social Security Number
// from an object, if included.
riposte.use(Riposte.HANDLE_SANITIZE_REPLY_DATA, function (data, options = {}, cb, riposte) {
  if(data && data["SSN"]) {
    log.info("Sanitizing data by removing SSN from the response object.\nData Pre-Sanitize:  %s", JSON.stringify(data, undefined, 2));
    delete data.SSN;
    cb(undefined, data);
  }
});


/* ************************************************** *
 * ******************** Configure Express
 * ************************************************** */

// Add the pre middleware to express.  This middleware will
// create a new reply instance on every request.  This should
// be the first route you add to express.
riposte.addExpressPreMiddleware(app);

// Add a route to express to simulate a successful API call.
app.get("/success", function(req, res, next) {
  res.reply.setData({ "firstName": "McLovin", "DOB": "06/03/1981", "SSN": "123-45-6789"}, next);
});

// Add a route to express to simulate an error in an API call.
app.get("/error", function (req, res, next) {
  // The method addErrors will add the new error to the reply object and continue onward.  If you want to immediately return the errors use the setErrors method.
  res.reply.addErrors(new Error("An error occurred during the API call."), next);
});

// Add a route to express to simulate a common error in an API call using a Reply helper method.
app.get("/forbidden", function (req, res, next) {
  // This will add the forbidden error and immediately send it to the client.
  res.reply.setForbidden(next);
});

// Add middleware to express to send the reply object and status code to the client at the end of every request.
// This should be the last route you add to express.
riposte.addExpressPostMiddleware(app);


/* ************************************************** *
 * ******************** Execute Requests
 * ************************************************** */

// Start the express server listening on port 3000 by default.
let server = app.listen(process.env.PORT || 3001, function () {
  let serverInfo = this.address(),
    address = "http://" + ((serverInfo.address === "0.0.0.0" || serverInfo.address === "::") ? "localhost" : serverInfo.address) + ":" +serverInfo.port,
    tasks = [];

  console.log("Listening on %s\n", address);

  // Add a task to make a successful API request.
  tasks.push((cb) => { request(address + "/success", cb); });

  // Add a task to make an API request that will contain an error.
  tasks.push((cb) => { request(address + "/error", cb); });

  // Add a tasks to make an API request that should return forbidden.
  tasks.push((cb) => { request(address + "/forbidden", cb); });

  // Add a tasks to make an API request to an endpoint that doesn't exist.
  tasks.push((cb) => { request(address + "/doesNotExist", cb); });

  // Perform all the requests in order, then close the server.
  async.series(tasks, (err, results) => {
    if(err) {
      log.error(err);
    }
    server.close();
  });
});