'use strict'
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const async = require('async');
var question = require('./question.js');
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const server = app.listen(process.env.PORT || 3000, () => {
  console.log('Express server listening on port %d in %s mode', server.address().port, app.settings.env);
});


function sendMessage(event) {
  var GOOGLE_API_KEY = 'AIzaSyAgWYqV90V6NCI3CUNWStkwH9-rPRsnt4M';
  var FACEBOOK_ACCESS_TOKEN = '';
  let sender = event.sender.id;
  var topic = event.message.text.replace(/\s/g, ""); // Removing whitespace from input to use in request url
  function wikiNotFoundError() { // generalized error message when no data for questions is found
    request({
      url: 'https://graph.facebook.com/v2.10/me/messages',
      qs: { access_token: 'EAARiEsAuvXEBAHvp6kDS4bAcyIrkudgRZCieT78BWO7ZAsbfAzIdkjMe7EJlv731DezS6Ic5crJs2OOTZCIVXVf3GijGjnwzNRkcZAwJHJaFPfdERSsp9dvZCuKUnCchIEZCjE9BOv58Pcc6EdrKV3wSK5lkKkDLhqGFjwjUua0gZDZD' },
      method: 'POST',
      json: {
        recipient: { id: sender },
        message: { text: 'I\'m sorry. I did not receive any data. Please try again!' }
      }
    });
  }

  function get50Questions(articles, callback) {
    var articlesData = [];
    async.forEachOf(articles, function (value, key, callback) {
      var siteUrl = 'http://' + topic + '.wikia.com/api/v1/Articles/AsSimpleJson?id=' + value;
      request.get(siteUrl, function (error, response, body) {
        if (!error && response.statusCode === 200) {
          try {
            var sections = JSON.parse(body).sections;
          }
          catch (e) {
            wikiNotFoundError();
            return;
          }
          //console.log(sections[0].content[0].text);
          if (sections[key]) {
            for (var i = 0; i < sections.length; i++) {
              if (sections[key].content[i]) {
                if (sections[key].content[i].text) {
                  articlesData.push(sections[key].content[i].text);
                  break;
                }
              }
            }
          }
          callback();
        } else {
          console.log(JSON.stringify(body));
          request({
            url: 'https://graph.facebook.com/v2.10/me/messages',
            qs: { access_token: 'EAARiEsAuvXEBAHvp6kDS4bAcyIrkudgRZCieT78BWO7ZAsbfAzIdkjMe7EJlv731DezS6Ic5crJs2OOTZCIVXVf3GijGjnwzNRkcZAwJHJaFPfdERSsp9dvZCuKUnCchIEZCjE9BOv58Pcc6EdrKV3wSK5lkKkDLhqGFjwjUua0gZDZD' },
            method: 'POST',
            json: {
              recipient: { id: sender },
              message: { text: 'I\'m sorry. I did not receive any data. Please try again!' }
            }
          });
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
          var siteUrl = 'https://language.googleapis.com/v1beta2/documents:analyzeEntities?key=' + GOOGLE_API_KEY;
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
                  "content": articlesData[0]
                },
                "encodingType": "UTF8"
              },
              json: true
            }
          request(options, function (error, response, body) {
            if (!error && response.statusCode === 200) {
              var data = body.entities;
              data.sort(function (a, b) {
                return b.salience - a.salience;
              });
              console.log(data);
              if (data.length > 1) {
                var key = data[0].name;
                var index = data[0].mentions[0].text.beginOffset;
                var length = key.length;
                console.log(length);
                var newText = articlesData[0];
                var blank = '_______';
                newText = articlesData[0].substring(0, index) + blank + articlesData[0].substring(index + length);
                request({
                  url: 'https://graph.facebook.com/v2.10/me/messages',
                  qs: { access_token: 'EAARiEsAuvXEBAHvp6kDS4bAcyIrkudgRZCieT78BWO7ZAsbfAzIdkjMe7EJlv731DezS6Ic5crJs2OOTZCIVXVf3GijGjnwzNRkcZAwJHJaFPfdERSsp9dvZCuKUnCchIEZCjE9BOv58Pcc6EdrKV3wSK5lkKkDLhqGFjwjUua0gZDZD' },
                  method: 'POST',
                  json: {
                    recipient: { id: sender },
                    message: { text: newText }
                  }
                });
              }
              else {
                wikiNotFoundError();
              }
            }
          });
        });
      }
    });
  }
  var options =
    {
      header: 'Accept: application/vnd.heroku+json; version=3',
      url: 'https://api.heroku.com/apps/qwikia/config-vars',
      method: 'GET'
    }
  request(options, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      console.log(body);
      getFiftyArticles();
    } else {
      console.log("Error in config vars");
    }
  });
}

app.get('/webhook', (req, res) => { // For Facebook Webhook Verification
  if (req.query['hub.mode'] && req.query['hub.verify_token'] === 'tuxedo_cat') {
    res.status(200).send(req.query['hub.challenge']);
  } else {
    res.status(403).end();
  }
});

app.post('/webhook', (req, res) => {
  console.log(req.body);
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