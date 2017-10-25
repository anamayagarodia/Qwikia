var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var TopicSchema = new Schema({
	topic_id: {type: String},
	topic: {type: String},
	questions: [{
		question: String,
		 users: [{
			user: String
			}]
		}]
});
TopicSchema.index({ topic_id: 1}, { unique: true });
module.exports = mongoose.model("Topic", TopicSchema);
