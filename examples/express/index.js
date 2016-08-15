let app = (require("express"))(),
  bunyan = require('bunyan'),
  PrettyStream = require('bunyan-pretty-stream'),
  request = require("request"),
  riposte = new (require("../../libs/index.js"))();  // Require and create a new Riposte instance.

// You can add a bunyan logger instance to Riposte for all logging, including logging all requests and replies.
let log = bunyan.createLogger({
  name: "Riposte-Example",
  serializers: bunyan.stdSerializers,
  streams: [
    {
      level: 'trace',
      stream: new PrettyStream()
    }
  ]
});

// Optionally, here you could configure Riposte options and handlers.
riposte.set({
  "log": log
});

// Add the middleware to express to create a new reply instance on every request.
// This should be the first route you add to express.
riposte.addExpressPreMiddleware(app);

// Add a route to express to simulate a successful API call.
app.get("/success", function(req, res, next) {
  res.reply.setData("Woot, a successful API call.", next);
});

// Add a route to express to simulate an error in an API call.
app.get("/error", function (req, res, next) {
  res.reply.addErrors(new Error("An error occurred during the API call."), next);
});

// Add a route to express to simulate an error in an API call using a Reply helper method.
app.get("/forbidden", function (req, res, next) {
  // This will add the forbidden error and immediately send it to the client.
  res.reply.setNotFound(next);
});

// Add middleware to express to send the reply object and status code to the client at the end of every request.
// This should be the last route you add to express.
riposte.addExpressPostMiddleware(app);

// Start the express server listening on port 3000 by default.
let server = app.listen(process.env.PORT || 3001, function () {
  let serverInfo = this.address();
  let address = "http://" + ((serverInfo.address === "0.0.0.0" || serverInfo.address === "::") ? "localhost" : serverInfo.address) + ":" +serverInfo.port;

  console.log("Listening on %s", address);

  // Note:  The logs for the following API requests may appear out of order, this is expected.

  // Make a successful API request.
  request(address+"/success", function (err, response, body) {
    if( ! err && response.statusCode == 200) {
      console.log("A GET request to \"%s/success\" returned a successful response body of %s", address, body);
    }
  });

  // Make an API request that will contain an error.
  request(address+"/error", function (err, response, body) {
    if( ! err) {
      console.log("A GET request to \"%s/error\" returned an error message in the response body %s", address, body);
    }
  });

  // Make an API request that should return forbidden.
  request(address+"/forbidden", function (err, response, body) {
    if( ! err) {
      console.log("A GET request to \"%s/forbidden\" returned an error message in the response body %s", address, body);
    }
  });

  setTimeout(function () {
    server.close();
  }, 5000)
});