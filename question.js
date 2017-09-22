
var request = require('request');
function getQuestionFromText(text, title) {
    var YOUR_API_KEY = 'AIzaSyAgWYqV90V6NCI3CUNWStkwH9-rPRsnt4M';
    var siteUrl = 'https://language.googleapis.com/v1beta2/documents:analyzeEntities?key='+YOUR_API_KEY;
    var options =
    {
        url: siteUrl,
        method: 'POST',
        body:
        {
            "document":
            {
              "type":"PLAIN_TEXT",
              "language": "EN",
              "content": text
            },
            "encodingType":"UTF8"
        },
        json: true
    }
    request(options, function (error, response, body) {
        if(!error && response.statusCode === 200) {
            var data = body.entities;
            data.sort(function(a, b){
                return b.salience - a.salience;
            });
            console.log(data);
            var key = data[0].name;
            var index = data[0].mentions[0].text.beginOffset;
            var length = key.length;
            console.log(length);
            var newText = text;
            var blank='';
            for(var i = 0; i < length; i++) {
                blank+='_';
            }
            newText = text.substr(0,index) + blank + text.substr(index+length);
            request({
                  url: 'https://graph.facebook.com/v2.10/me/messages',
                  qs: {access_token: 'EAARiEsAuvXEBAHvp6kDS4bAcyIrkudgRZCieT78BWO7ZAsbfAzIdkjMe7EJlv731DezS6Ic5crJs2OOTZCIVXVf3GijGjnwzNRkcZAwJHJaFPfdERSsp9dvZCuKUnCchIEZCjE9BOv58Pcc6EdrKV3wSK5lkKkDLhqGFjwjUua0gZDZD'},
                  method: 'POST',
                  json: {
                    recipient: {id: sender},
                    message: {text: newText}
                  }
                });
              }
    });
}
module.exports.getQuestionFromText = getQuestionFromText;

// getQuestionFromText("Edd, also called Dolorous Edd, is a member of the Night's Watch. Edd swore his oath when he was fifteen. His nickname is due to his sarcastic and pessimistic sense of humour.", 'got');
/* var result = 
{
    "entities":
    [{
        "name":"Edd",
        "type":"PERSON",
        "metadata":{},
        "salience":0.73725903,
        "mentions":[
            {
                "text":
                {
                    "content":"Edd",
                    "beginOffset":0
                },
                "type":"PROPER"
            },
            {
                "text":
                {
                    "content":"Edd",
                    "beginOffset":65
                },
                "type":"PROPER"
            }]
        }, {}],
        "language":"en"
    };
 */