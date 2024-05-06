import { trim } from "logos:core/formatting";
import { Modal, ModalComposer } from "logos/commands/components/modal-composers/modal-composer";
import { ReportFormData } from "logos/database/report";

class ReportComposer extends ModalComposer<ReportFormData, never> {
	async buildModal(
		submission: Logos.Interaction,
		{ formData }: { formData: ReportFormData },
	): Promise<Modal<ReportFormData>> {
		const strings = constants.contexts.reportModal({
			localise: this.client.localise.bind(this.client),
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
