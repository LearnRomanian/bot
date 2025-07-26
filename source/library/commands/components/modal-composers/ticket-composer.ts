import { trim } from "rost:constants/formatting";
import { type Modal, ModalComposer } from "rost/commands/components/modal-composers/modal-composer";
import type { TicketFormData } from "rost/models/documents/ticket";

class TicketComposer extends ModalComposer<TicketFormData, never> {
	buildModal(submission: Rost.Interaction, { formData }: { formData: TicketFormData }): Modal<TicketFormData> {
		const strings = constants.contexts.ticketModal({
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
							customId: "topic",
							type: Discord.MessageComponentTypes.InputText,
							label: trim(strings.topic, 45),
							style: Discord.TextStyles.Paragraph,
							required: true,
							maxLength: 100,
							value: formData.topic,
						},
					],
				},
			],
		};
	}
}

export { TicketComposer };
