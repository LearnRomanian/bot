import { trim } from "rost:constants/formatting";
import { type Modal, ModalComposer } from "rost/commands/components/modal-composers/modal-composer";
import type { ReportFormData } from "rost/models/documents/report";

class ReportComposer extends ModalComposer<ReportFormData, never> {
	buildModal(submission: Rost.Interaction, { formData }: { formData: ReportFormData }): Modal<ReportFormData> {
		const strings = constants.contexts.reportModal({
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
							customId: "users",
							type: Discord.MessageComponentTypes.InputText,
							label: trim(strings.fields.users, 45),
							style: Discord.TextStyles.Short,
							required: true,
							value: formData.users,
						},
					],
				},
				{
					type: Discord.MessageComponentTypes.ActionRow,
					components: [
						{
							customId: "messageLink",
							type: Discord.MessageComponentTypes.InputText,
							label: trim(strings.fields.link, 45),
							style: Discord.TextStyles.Short,
							required: false,
							value: formData.messageLink ?? "",
						},
					],
				},
			],
		};
	}
}

export { ReportComposer };
