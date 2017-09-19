/// CURRENT CODE


/*-----------------------------------------------------------------------------
A simple echo bot for the Microsoft Bot Framework. 
-----------------------------------------------------------------------------*/
'use strict'
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const async = require('async');
const app =express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true}));

const server = app.listen(process.env.PORT || 3000, () => {
    console.log('Express server listening on port %d in %s mode', server.address().port, app.settings.env);
});

function sendMessage(event) {
    let sender = event.sender.id;
    var topic = event.message.text;
    
    function get50Questions(articles, callback) {
      var articlesData = [];      
      async.forEachOf(articles, function ( value, key, callback) {
        var siteUrl = 'http://' + topic + '.wikia.com/api/v1/Articles/AsSimpleJson?id=' + value;
        request.get(siteUrl, function(error, response, body) {
          if(!error && response.statusCode === 200) {
            var sections = JSON.parse(body).sections;
            console.log(sections[0].content[0].text);
            articlesData.push(sections[0].content[0].text);
            callback();
          }
        });
      }, function (err) {
        if (err) {
          console.log("\n\n\nBLAHERROR");
          return callback(null);
        } else {
          console.log("\n\n\nBLAH");
          return callback(articlesData);
        }
      });
    }

    function getFiftyArticles() {
      var articles =[];
      var siteUrl = 'http://' + topic + '.wikia.com/api/v1/Articles/Top?Limit=250';
      var rand;
      // Create list of 250 popular articles
      request.get(siteUrl, function(error, response, body) {
        if(!error && response.statusCode === 200) {
          var items = JSON.parse(body).items;
          var itemsCount = items.length;
          for(var i = 0; i < 50; i++) {
            rand = Math.random();
            rand *= itemsCount;
            articles.push(items[Math.floor(rand)].id);
          }
          get50Questions(articles, function(articlesData) {
            console.log("\n\n\nREACHED MESSAGE FUNCTION");
            console.log(articlesData[0]);
            request({
            url: 'https://graph.facebook.com/v2.10/me/messages',
            qs: {access_token: 'EAARiEsAuvXEBAHvp6kDS4bAcyIrkudgRZCieT78BWO7ZAsbfAzIdkjMe7EJlv731DezS6Ic5crJs2OOTZCIVXVf3GijGjnwzNRkcZAwJHJaFPfdERSsp9dvZCuKUnCchIEZCjE9BOv58Pcc6EdrKV3wSK5lkKkDLhqGFjwjUua0gZDZD'},
            method: 'POST',
            json: {
                recipient: {id: sender},
                message: {text: articlesData[0]}
            }
          });
        });
      }
    });
  }
  getFiftyArticles();
}

app.get('/webhook', (req, res) => {
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

/* var bot = new builder.UniversalBot(connector, function (session) {
  function processElements(arr, str){
    if(arr.length == 0) {
      return str;
    }
    else {
      for(var i = 0; i < arr.length; i++) {
        str+=arr[i].text;
        processElements(arr[i].elements, str);
      }
      return str;
    }
  }
  var topic = session.message.text;
  var articles = [];
  var questions = [];
  function getFiftyArticles() {
    var siteUrl = 'http://' + topic + '.wikia.com/api/v1/Articles/Top?Limit=250';
    var rand;
    // Create list of 250 popular articles
    request.get(siteUrl, function(error, response, body) {
      if(!error && response.statusCode === 200) {
        var items = JSON.parse(body).items;
        var itemsCount = items.length;
        for(var i = 0; i < 50 i++) {
          rand = Math.random();
          rand *= itemsCount;
          articles.push(items[Math.floor(rand)].id);
        }
        get50Questions(articles, function(articlesData) {
          getNLPData(articlesData);
        });
      }
    });
  }
  function findTriviaSection(sections) {
    for(var i = 0; i < sections.length; i++){
      if(sections[i].title === "Trivia") return i;
    }
    return -1;
  }
  function get50Questions(articles, callback) {
    var articlesData = [];
    async.forEachOf(articles, function ( value, key, callback) {
      var textArray = [];
      var siteUrl = 'http://' + topic + '.wikia.com/api/v1/Articles/AsSimpleJson?id=' + value;
      request.get(siteUrl, function(error, response, body) {
        if(!error && response.statusCode === 200) {
          var sections = JSON.parse(body).sections;
          // Look for Trivia section
          var triviaIndex = findTriviaSection(sections);
          var triviaText = '';
          if(triviaIndex > -1) {
            var content = sections[triviaIndex].content;
            for(var j = 0; j < content.length; j++) {
              if(content[j].type === "paragraph") {
                triviaText+=content[j].text;
                triviaText+=" ";
              }
              else if(content[j].type === "list") {
                triviaText+=processElements(content[j].elements, '');
              }
              else {
                console.log("!!!!!!!!!NEW TYPE DETECTED!!!!!!!!");
              }
            }
            textArray.push(triviaText);
          } else {
            var summary = sections[0].content;
            var summaryText = '';
            for(var j = 0; j < summary.length; j++) {
              if(summary[j].type === "paragraph") {
                summaryText += summary[j].text;
              } else if(summary[j].type === "list") {
                summaryText+=processElements(summary[j].elements, '');
              } else {
                console.log("!!!!!!!!!NEW TYPE DETECTED!!!!!!!!");
              }
            }
            // Can't find Trivia section
            for(var i = 1; i < sections.length; i++) {
              var content = sections[i].content;
              var text = '';
              for(var j = 0; j < content.length; j++) {
                if(content[j].type === "paragraph") {
                  text+=content[j].text;
                }
                else if(content[j].type === "list") {
                  text+=processElements(content[j].elements, '');
                }
                else {
                  console.log("!!!!!!!!!NEW TYPE DETECTED!!!!!!!!");
                }
              }
              textArray.push(text)
              
            }
            
          }
          var articleData = new Object();
          if(triviaText.length > 0) {
            summaryText = triviaText;
          }
          articleData["summary"] = summaryText;
          articleData["rest"] = textArray;
          articlesData.push(articleData);
          callback();
        }
      });
    },
    function (err) {
      if(err)
      return callback(null);
      else {
        return callback(articlesData);
      }
    })
  }
  function getNLPData(articlesData) {
    session.send(articlesData);
  }
  getFiftyArticles();
}); */