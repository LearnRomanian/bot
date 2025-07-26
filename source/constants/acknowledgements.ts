import { type Contributor, contributors } from "rost:constants/contributions";

interface Acknowledgement {
	readonly users: Contributor[];
	readonly reason: string;
}

export default Object.freeze([
	{
		users: [contributors.nemokosch, contributors["16wardm"], contributors.victor, contributors.mymy],
		reason: "Thank you for testing the bot and its features, flagging up issues, making suggestions, listening to an awful lot of complaining about various pieces of software that Rost uses as well as Discord itself at times.",
	},
	{
		users: [contributors.nemokosch],
		reason: "Thanks for sharing your knowledge of programming and software, and all the discussions and conversations had over the past few years in relation to it.",
	},
	{
		users: [contributors.pascu],
		reason: "Thank you for suggesting the name 'Logos'. Your suggestion ended a long cycle of thinking and rethinking different names, beginning with 'Teacher', going through 'Luna', 'Myna', 'Mollie', the notorious 'Talon', even 'Cards' and 'Tarots' and finally landing on 'Logos', which has now been the name for almost the past two years.",
	},
	{
		users: [{ username: "The moderation teams on LR + LA", id: "0" }],
		reason: "Thank you for putting up with the bot's various faults over time preventing you from fulfilling your functions properly.",
	},
	{
		users: [{ username: "The volunteer translators", id: "0" }],
		reason: "Without them and the time and effort they put into the translations, the bot would not be accessible to as large an audience as it is today and will be in the future.",
	},
] satisfies Acknowledgement[] as Acknowledgement[]);
