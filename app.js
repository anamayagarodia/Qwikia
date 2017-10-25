'use strict'
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const async = require('async');
var question = require('./question.js');
var mongoose = require('mongoose');
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const DEBUG = true;

const server = app.listen(process.env.PORT || 3000, () => {
  console.log('Express server listening on port %d in %s mode', server.address().port, app.settings.env);
});


function sendMessage(event) {
  var GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  var FACEBOOK_ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
  var FACEBOOK_VERIFICATION_TOKEN = process.env.FACEBOOK_VERIFICATION_TOKEN;
  var MONGODB_URI = process.env.MONGODB_URI;
  var db = mongoose.connect(MONGODB_URI);
  var Topic = require("./models/topic");
  let sender = event.sender.id;
  var topic = event.message.text.replace(/\s/g, ""); // Removing whitespace from input to use in request url
  function wikiNotFoundError() { // generalized error message when no data for questions is found
    request({ // request to facebook page to send error message
      url: 'https://graph.facebook.com/v2.10/me/messages',
      qs: { access_token: FACEBOOK_ACCESS_TOKEN },
      method: 'POST',
      json: {
        recipient: { id: sender },
        message: { text: 'I\'m sorry. I did not receive any data. Please try again!' }
      }
    });
  }
  function alreadyAsked() { // generalized error message when no data for questions is found
    request({ // request to facebook page to send error message
      url: 'https://graph.facebook.com/v2.10/me/messages',
      qs: { access_token: FACEBOOK_ACCESS_TOKEN },
      method: 'POST',
      json: {
        recipient: { id: sender },
        message: { text: 'I\'m sorry. I have already asked you this question. Please try again!' }
      }
    });
  }

  function sendQuestion(articlesData) {
    var siteUrl = 'https://language.googleapis.com/v1beta2/documents:analyzeEntities?key=' + GOOGLE_API_KEY; // Google NLP API url
    var options =
      {
        url: siteUrl,
        method: 'POST',
        body:
        {
          "document":
          {
            "type": "PLAIN_TEXT",
            "language": "EN",
            "content": articlesData[0] // first text paragraph in first article for now
          },
          "encodingType": "UTF8"
        },
        json: true
      }
    request(options, function (error, response, body) {
      if (!error && response.statusCode === 200) {
        var data = body.entities;
        data.sort(function (a, b) { // sorting entities according to their salience
          return b.salience - a.salience;
        });
        if (data.length > 1) {
          var blank = '_______';
          var key = data[0].name;
          var index = data[0].mentions[0].text.beginOffset;
          if (data[0]) {
            for (var j = 0; j < data[0].mentions.length; j++) {
              if (data[0].mentions[j]) {
                if (data[0].mentions[j].text.content === key && data[0].mentions[j].type === "PROPER") {
                  key = data[0].name;
                  index = data[0].mentions[j].text.beginOffset;
                  break;
                }
              }
            }
          }
          for (var i = 1; i < data.length; i++) {
            if (data[i]) {
              for (var j = 0; j < data[i].mentions.length; j++) {
                if (data[i].mentions[j]) {
                  if (data[i].mentions[j].text.content === data[i].name && data[i].mentions[j].type === "PROPER") {
                    key = data[i].name;
                    index = data[i].mentions[j].text.beginOffset;
                    break;
                  }
                }
              }
            }
            if (key != data[0].name && topic.toLowerCase() != key.replace(/\s/g, "").toLowerCase()) {
              break;
            }
          }
          //var length = key.length;
          var newText = '';
          var blank = '_______';

          // Insert blanks into all occurrences of answer within question
          var arrAns = articlesData[0].split(key);
          for (var i in arrAns) {
            newText += arrAns[i];
            if (i < arrAns.length - 1) {
              newText += blank;
            }
          }
          var query = { topic: topic };
          var foundQ = false;
          var foundS = false;
          var qIndex = 0;
          Topic.findOne({ topic: topic }, function (err, DBTopic) {
            if (DBTopic) {
              for (var i = 0; i < DBTopic.questions.length; i++) {
                if (DBTopic.questions[i].question == newText) {
                  foundQ = true;
                  qIndex = i;
                  for (var j = 0; j < DBTopic.questions[i].users.length; j++) {
                    if (DBTopic.questions[i].users[j].user == sender) {
                      foundS = true;
                      break;
                    }
                  }
                  break;
                }
              }
            }
            var update;
            var question = {
              question: newText,
              users: [{ user: sender }]
            }
            if (!foundQ) {
              update = {
                topic: topic,
                $push: { questions: question }
              }
              var options = { upsert: true };
              Topic.findOneAndUpdate(query, update, options, function (err, top) {
                if (err) {
                  alreadyAsked();
                } else {
                  console.log('ANSWER: ' + key);
                  request({
                    url: 'https://graph.facebook.com/v2.10/me/messages',
                    qs: { access_token: FACEBOOK_ACCESS_TOKEN },
                    method: 'POST',
                    json: {
                      recipient: { id: sender },
                      message: { text: newText }
                    }
                  });
                }
              });
            } else if (!foundS) {
              var str = "questions." + qIndex + ".users";
              update = {
                $push: { str: { user: sender } }
              }
              var options = { upsert: true };
              Topic.findOneAndUpdate(query, update, options, function (err, top) {
                if (err) {
                  alreadyAsked();;
                } else {
                  console.log('ANSWER: ' + key);
                  request({
                    url: 'https://graph.facebook.com/v2.10/me/messages',
                    qs: { access_token: FACEBOOK_ACCESS_TOKEN },
                    method: 'POST',
                    json: {
                      recipient: { id: sender },
                      message: { text: newText }
                    }
                  });
                }
              });
            } else {
              alreadyAsked();
            }
          });
        } else {
          wikiNotFoundError();
        }
      }
    });
  }

function get50Questions(articles, callback) {
  var articlesData = [];
  async.forEachOf(articles, function (value, key, callback) {
    var siteUrl = 'http://' + topic + '.wikia.com/api/v1/Articles/AsSimpleJson?id=' + value; // wikia API url
    request.get(siteUrl, function (error, response, body) {
      if (!error && response.statusCode === 200) {
        try {
          var sections = JSON.parse(body).sections; // get all the sections in the article
        }
        catch (e) {
          wikiNotFoundError();
          return;
        }
        for (var i = 0; i < sections.length; i++) {
          if (sections[i]) { //if the section has data
            if (sections[i].content[0]) { // if the content has data
              if (sections[i].content[0].text) { // if the text exists
                articlesData.push(sections[i].content[0].text);
                break;
              }
            }
          }
        }
        callback(); // sendQuestion()
      } else {
        wikiNotFoundError();
      }
    });
  }, function (err) {
    if (err) {
      return callback(null);
    } else {
      return callback(articlesData);
    }
  });
}

function getFiftyArticles() {
  var articles = [];
  var siteUrl = 'http://' + topic + '.wikia.com/api/v1/Articles/Top?Limit=250';
  var rand;
  // Create list of 250 popular articles
  request.get(siteUrl, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      try {
        var items = JSON.parse(body).items;
      }
      catch (e) {
        wikiNotFoundError();
        return;
      }
      var itemsCount = items.length;
      var noOfQs = (itemsCount < 50) ? itemsCount : 50;
      for (var i = 0; i < noOfQs; i++) {
        rand = Math.random();
        rand *= itemsCount;
        articles.push(items[Math.floor(rand)].id);
      }
      get50Questions(articles, function (articlesData) {
        sendQuestion(articlesData);
      });
    }
  });
}
getFiftyArticles();
}

app.get('/webhook', (req, res) => { // For Facebook Webhook Verification
  if (req.query['hub.mode'] && req.query['hub.verify_token'] === FACEBOOK_VERIFICATION_TOKEN) {
    res.status(200).send(req.query['hub.challenge']);
  } else {
    res.status(403).end();
  }
});

app.post('/webhook', (req, res) => {
  if (req.body.object === 'page') {
    req.body.entry.forEach((entry) => {
      entry.messaging.forEach((event) => {
        if (event.message && event.message.text) {
          sendMessage(event);
        }
      });
    });
    res.status(200).end();
  }
});
