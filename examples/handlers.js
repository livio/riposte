let Riposte = require('../../libs/index.js');

// Create a new riposte instance.  The constructor accepts
// options used to configure your new instance of Riposte.
let riposte = new Riposte();

// Or you can configure the riposte instance anytime using
// the set method.
riposte.set({});






// Riposte can be used to create Reply objects.  A Reply
// stores data that will be returned to a client.  It also
// contains methods and meta data about how to deliver
// information.  Let's create a new Reply object.
let reply = riposte.createReply();

// Add some data to the Reply object.
reply.setData({ "firstName": "McLovin", "DOB": "06/03/1981"});

// Now we can convert the reply into a JSON data object we can send to the client.
riposte.send(reply, undefined, function(err, obj) {
  if(err) {
    // Handle any errors generated while sending the data object.
    console.log(err);
  } else {
    // The object includes the current HTTP Status Code,
    // a unique request/response ID, and the data we added.
    console.log("First response:  %s\n", JSON.stringify(obj, undefined, 2));
  }
});

// Awesome, now let's add some errors to the reply that occurred while handling the request.
reply.addErrors(new Error("Something terrible has happened."), function(err, replyErrors) {
  if(err) {
    // Handle any errors generated while adding the errors.
    console.log(err);
  } else {

    // Let's convert the reply again into an object we can send to the client.
    riposte.send(reply, undefined, function(err, obj) {
      if(err) {
        // Handle any errors generated while sending the data object.
        console.log(err);
      } else {
        // The object includes the current HTTP Status Code,
        // a unique request/response ID, the errors, and data we added.
        console.log("Second response:  %s", JSON.stringify(obj, undefined, 2));
      }
    });
  }
});