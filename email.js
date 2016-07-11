try {
  var request     = require('request');
  var _           = require('underscore');
  var chalk       = require('chalk');
  var path        = require('path');
  var fs          = require('fs');
  var exec        = require('child_process').exec;
  var emailjs     = require('emailjs');
  var _           = require('underscore');
  var uDeepExtend = require('underscore-deep-extend');
  var prompt      = require('prompt');
  _.mixin({deepExtend: uDeepExtend(_)});


} catch (e) {
  consoleRed(e.toString());
  consoleYellow('Please run `npm install`\n');
  process.exit(1);
}

var emailAddresses = {
	from: "admin@dominicminicoopers.com",
	sms: "6232715020@vtext.com",
	monitor: "dominicminicoopers@yahoo.com"},
  password = "",
  url = "http://www.fillaseatphoenix.com/includes/eventjson.php?d=",
  fileNames = {
    logging: "data/logging.txt", 
    events: "data/events.json" },
  timerMinutes = 10,
  timerMs = timerMinutes * 60 * 1000,
  aliveCntr = 0;

prompt.start();
prompt.get({properties: {
    password: {
      hidden: true,
      required: true,
      description: "Provide password for " + emailAddresses.from
    }
  }}, function(err, result){
    if(err) {
      consoleRed("Password read error: " + err);
      process.exit(1);
    } 
    consoleGreen("Password set. Starting monitor of url");

    password = result.password;

    // run the watcher now that we have an email password
    execWatcher();
  });

function getNotSoldOutEvents(events) {
  ////// typcial FillASeat event.  
  ////// ** PID for their unique identifier: http://www.fillaseatphoenix.com/includes/getPerformance.php?pid=5546
  ////// ** soldout is ignored
  ////// ** isSoldOut is used
  // { eid: '922',
  //   pid: '5546',
  //   shortDesc: '50 shades',
  //   isfeatured: '0',
  //   soldout: '0',
  //   date: '2015-12-11',
  //   time: '07:00 PM',
  //   pa: '1',
  //   ea: '1',
  //   display_time_start: '00:00:00',
  //   display_time_end: '15:00:00',
  //   display_date_end: '2015-12-11',
  //   display_date_start: '2015-11-27',
  //   cs: '0',
  //   isSoldOut: null,
  //   imgurl: '/includes/get_img.php?eid=922&size=lg_preview&site_version=24481' }

  var notSoldOutEvents = _.reject(events, {isSoldOut: 1 });
  return notSoldOutEvents;
}
function findNewEvents(previousData, currentData) {
  return _.difference(currentData, previousData);
}
function getPreviousEvents() {
  consoleWhite("Reading file: " + fileNames.events);
  var fileContents = fs.readFileSync(fileNames.events,{encoding:"UTF8"});
  var events = JSON.parse(fileContents);
  consoleGreen("Loaded events from file.")
  return events;
}

function saveCurrentEvents(eventsObj) {
  consoleWhite("Saving file: " + fileNames.events);
  fs.writeFileSync(fileNames.events, JSON.stringify(eventsObj), {encoding:"UTF8"});
  consoleGreen("Saved events to file.")
}

function getDateFormatted() {
  var today = new Date();
  return today.getFullYear() + "-" + (today.getMonth()+1) + "-" + today.getDate();
}

function setWatcherTimeout() {
  var msRnd = timerMs * getRandom(0.75, 1.25);
  consoleWhite("Setting timeout for " + msRnd + "ms");
  setTimeout(execWatcher, msRnd);
}

function execWatcher() {
  try {

	// 25 = every 4 hours or so based upon about 10 minutes per cycle
	if(aliveCntr % 25 == 0) {
	  consoleWhite("sending still alive email " + aliveCntr);
	  sendEmail("Still alive (" + aliveCntr + ")", emailAddresses.monitor);
	}
	aliveCntr++;
	
    var fillUrl = url + getDateFormatted();
    consoleWhite("Downloading url: " + fillUrl);
    request(fillUrl, function(error, res, body) {
      if(error) {
        throw error;
      }

      consoleGreen('Downloaded events successful.');
	  
	  var currentEvents = parseEventDescArr(body),
		previousEvents = getPreviousEvents(),
		newEvents = findNewEvents(previousEvents, currentEvents);
	  logEventsRead(currentEvents);
	  
      if(newEvents.length > 0 ) {
        var eventsStr = newEvents.join( ' :: ');
        consoleYellow("Found new events: " + eventsStr);
        sendEmail(eventsStr, emailAddresses.sms, emailAddresses.monitor);          
      } else {
        consoleYellow("No new events found... :-( ");
      }
      saveCurrentEvents(currentEvents); // save the current events so they become previous events next time around
	  
      setWatcherTimeout();
    });


  } catch(e) {
    consoleRed("execWatcher error: " + e.toString());
    setWatcherTimeout();
  }
}
function parseEventDescArr(body){
  body = body.substring(1, body.length-1);      
  var objData = JSON.parse(body);
  var eventsJson = unescape(objData.data);
  var fullObjEvents = JSON.parse(eventsJson);
  var fullObjHasSeatsEvents = getNotSoldOutEvents(fullObjEvents);
  var currentEvents = _.pluck(fullObjHasSeatsEvents, 'shortDesc');
  return currentEvents;
}
function sendEmail(eventDetail, toEmailAddress, ccEmailAddress) {
  var server  = emailjs.server.connect({
     user:     emailAddresses.from, 
     password: password, 
     host:     "smtpout.secureserver.net", 
     ssl:      true
  });

  // send the message and get a callback with an error or details of the message that was sent
  var sendEnvelope = {
     from:    "<" + emailAddresses.from + " >", 
     to:      "<" + toEmailAddress + ">",
     subject: "Fill-A-Seat " + getDateTime(),
     text:    eventDetail
  };
  if(ccEmailAddress) sendEnvelope.cc = "<" + ccEmailAddress + ">";
  server.send(sendEnvelope, function(err, message) { 
    if(err) {
      consoleRed("Email error: " + err);      
    } else {
      consoleGreen("Email sent for: " + eventDetail);
    }
  });

}

function getDateTime() {
	var currentdate = new Date(),
	  datetime = currentdate.getDate() + "/"
		+ (currentdate.getMonth()+1)  + "/" 
		+ currentdate.getFullYear() + " "  
		+ currentdate.getHours() + ":"  
		+ currentdate.getMinutes() + ":" 
		+ currentdate.getSeconds();
	return datetime;				
}

function logEventsRead(eventsStr) {
  var newText = "\n" + getDateTime() + ": " + eventsStr;
  fs.appendFileSync(fileNames.logging, newText);
  consoleGreen("Logged events: " + eventsStr);
}

// Returns a random number between min (inclusive) and max (exclusive)
function getRandom(min, max) {return Math.random() * (max - min) + min;}

function consoleGreen(str) {console.log(chalk.green( getDateTime() + ": " + str));}
function consoleRed(str) {console.log(chalk.red( getDateTime() + ": " + str));}
function consoleYellow(str) {console.log(chalk.yellow( getDateTime() + ": " + str));}
function consoleWhite(str) {console.log(chalk.white( getDateTime() + ": " + str));}