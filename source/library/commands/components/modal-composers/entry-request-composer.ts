import { trim } from "rost:constants/formatting";
import { type Modal, ModalComposer } from "rost/commands/components/modal-composers/modal-composer";
import type { EntryRequestFormData } from "rost/models/documents/entry-request";

class EntryRequestComposer extends ModalComposer<EntryRequestFormData, never> {
	buildModal(
		submission: Rost.Interaction,
		{ formData }: { formData: EntryRequestFormData },
	): Modal<EntryRequestFormData> {
		const strings = constants.contexts.verificationModal({
			localise: this.client.localise,
			locale: submission.locale,
		});
		return {
			title: strings.title,
			elements: [
				{
					type: Discord.MessageComponentTypes.ActionRow,
					components: [
						{
							customId: "reason",
							type: Discord.MessageComponentTypes.InputText,
							label: trim(strings.fields.reason, 45),
							style: Discord.TextStyles.Paragraph,
							required: true,
							value: formData.reason,
						},
					],
				},
				{
					type: Discord.MessageComponentTypes.ActionRow,
					components: [
						{
							customId: "aim",
							type: Discord.MessageComponentTypes.InputText,
							label: trim(strings.fields.aim, 45),
							style: Discord.TextStyles.Paragraph,
							required: true,
							value: formData.aim,
						},
					],
				},
				{
					type: Discord.MessageComponentTypes.ActionRow,
					components: [
						{
							customId: "whereFound",
							type: Discord.MessageComponentTypes.InputText,
							label: trim(strings.fields.whereFound, 45),
							style: Discord.TextStyles.Short,
							required: true,
							value: formData.whereFound,
						},
					],
				},
			],
		};
	}
}

export { EntryRequestComposer };
