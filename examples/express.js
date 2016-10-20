let express = require('express'),
  async = require('async'),
  i18next = require('i18next'),
  request = require("request"),
  Riposte = require('../libs/index.js');

// Create a new instance of Riposte
let riposte = new Riposte();  

// Create a new express application instance.
let app = express();

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

// We can add the translation library instance directly 
// into riposte to automatically handle translations.
riposte.set({
  "i18next": i18next
});

// Add the pre middleware to express.  This middleware will 
// create a new reply instance on every request.  This should 
// be the first route you add to express.
riposte.addExpressPreMiddleware(app);

// Add a route to express to simulate a successful API call.
app.get("/success", function(req, res, next) {
  res.reply.setData("Woot, a successful API call.", next);
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

// Start the express server listening on port 3000 by default.
let server = app.listen(process.env.PORT || 3001, function () {
  let serverInfo = this.address(),
    address = "http://" + ((serverInfo.address === "0.0.0.0" || serverInfo.address === "::") ? "localhost" : serverInfo.address) + ":" +serverInfo.port,
    tasks = [];

  console.log("Listening on %s\n", address);

  // Note:  The logs for the following API requests may appear out of order, this is expected.

  // Add a task to make a successful API request.
  tasks.push((cb) => {
    request(address + "/success", function (err, response, body) {
      if (!err && response.statusCode == 200) {
        console.log("A GET request to \"%s/success\" returned a successful response.\n", address);
      }
      cb(err);
    });
  });

  // Add a task to make an API request that will contain an error.
  tasks.push((cb) => {
    request(address + "/error", function (err, response, body) {
      if (!err) {
        console.log("A GET request to \"%s/error\" returned an error message.\n", address);
      }
      cb(err);
    });
  });

  // Add a tasks to make an API request that should return forbidden.
  tasks.push((cb) => {
    request(address + "/forbidden", function (err, response, body) {
      if ( ! err) {
        console.log("A GET request to \"%s/forbidden\" returned an error message.\n", address);
      }
      cb(err);
    });
  });

  // Add a tasks to make an API request to an endpoint that doesn't exist.
  tasks.push((cb) => {
    request(address + "/doesNotExist", function (err, response, body) {
      if ( ! err) {
        console.log("A GET request to \"%s/doesNotExist\" returned an error message.", address);
      }
      cb(err);
    });
  });

  // Perform all the requests in order, then close the server.
  async.series(tasks, (err, results) => {
    if(err) {
      console.log(err);
    }
    server.close();
  });
});
