import type { WithRequired } from "rost:core/utilities";
import type { Client } from "rost/client";
import { InteractionCollector } from "rost/collectors";

type TypedInputTextComponent<CustomID> = WithRequired<Discord.InputTextComponent, "value"> & { customId: CustomID };
interface ModalElement<FormData> {
	type: Discord.MessageComponentTypes.ActionRow;
	components: [TypedInputTextComponent<keyof FormData>];
}
interface Modal<FormData> {
	title: string;
	elements: ModalElement<FormData>[];
}
type SubmitEvent<FormData> = (interaction: Rost.Interaction, { formData }: { formData: FormData }) => Promise<void>;
/**
 * @remarks
 * IMPORTANT: When creating a new modal composer and implementing {@link buildModal}, make sure to link all of the
 * properties of {@link formData} to all the modal fields, otherwise data __will get lost__ if the user's initial
 * form data is rejected, and they choose to return to the form.
 */
abstract class ModalComposer<FormData, ValidationError extends string> {
	readonly client: Client;
	anchor: Rost.Interaction;

	readonly #submissions: InteractionCollector;
	#formData: FormData;
	#onSubmit?: SubmitEvent<FormData>;

	constructor(
		client: Client,
		{ interaction, initialFormData }: { interaction: Rost.Interaction; initialFormData?: FormData },
	) {
		this.client = client;

		this.anchor = interaction;

		this.#formData = initialFormData ?? ({} as FormData);

		this.#submissions = new InteractionCollector(client, {
			type: Discord.InteractionTypes.ModalSubmit,
			only: [interaction.user.id],
		});
	}

	static getFormData<FormData>(submission: Rost.Interaction): FormData | undefined {
		const content: Record<string, string | undefined> = {};

		const fields = submission.data?.components?.map((component) => component.components?.at(0));
		if (fields === undefined) {
			return undefined;
		}

		for (const field of fields) {
			if (field === undefined) {
				continue;
			}

			if (field.customId === undefined) {
				throw new Error("The custom ID of a submitted modal field was missing.");
			}

			const key = field.customId;
			const value = field.value ?? "";

			if (value.length > 0) {
				content[key] = value;
			} else {
				content[key] = undefined;
			}
		}

		return content as FormData;
	}

	abstract buildModal(interaction: Rost.Interaction, { formData }: { formData: FormData }): Modal<FormData>;

	validate(_: { formData: FormData }): ValidationError | undefined {
		return undefined;
	}

	getErrorMessage(
		_: Rost.Interaction,
		__: { error: ValidationError },
	): Discord.Camelize<Discord.DiscordEmbed> | undefined {
		return undefined;
	}

	async #display(): Promise<void> {
		const modal = this.buildModal(this.anchor, { formData: this.#formData });

		await this.client.displayModal(this.anchor, {
			title: modal.title,
			customId: this.#submissions.customId,
			components: modal.elements,
		});
	}

	async handleInvalid(
		submission: Rost.Interaction,
		{ error }: { error: ValidationError },
	): Promise<Rost.Interaction | undefined> {
		const { promise, resolve } = Promise.withResolvers<Rost.Interaction | undefined>();

		const continueButton = new InteractionCollector(this.client, { only: [submission.user.id], isSingle: true });
		const cancelButton = new InteractionCollector(this.client, { only: [submission.user.id] });
		const returnButton = new InteractionCollector(this.client, {
			only: [submission.user.id],
			isSingle: true,
			dependsOn: cancelButton,
		});
		const leaveButton = new InteractionCollector(this.client, {
			only: [submission.user.id],
			isSingle: true,
			dependsOn: cancelButton,
		});

		continueButton.onInteraction(async (buttonPress) => {
			this.client.deleteReply(submission).ignore();

			resolve(buttonPress);
		});

		cancelButton.onInteraction(async (cancelButtonPress) => {
			returnButton.onInteraction(async (returnButtonPress) => {
				this.client.deleteReply(submission).ignore();
				this.client.deleteReply(cancelButtonPress).ignore();

				resolve(returnButtonPress);
			});

			leaveButton.onInteraction(async (_) => {
				this.client.deleteReply(submission).ignore();
				this.client.deleteReply(cancelButtonPress).ignore();

				resolve(undefined);
			});

			const strings = constants.contexts.sureToCancelReport({
				localise: this.client.localise,
				locale: submission.locale,
			});
			this.client
				.warning(cancelButtonPress, {
					embeds: [
						{
							title: strings.title,
							description: strings.description,
						},
					],
					components: [
						{
							type: Discord.MessageComponentTypes.ActionRow,
							components: [
								{
									type: Discord.MessageComponentTypes.Button,
									customId: returnButton.customId,
									label: strings.stay,
									style: Discord.ButtonStyles.Success,
								},
								{
									type: Discord.MessageComponentTypes.Button,
									customId: leaveButton.customId,
									label: strings.leave,
									style: Discord.ButtonStyles.Danger,
								},
							],
						},
					],
				})
				.ignore();
		});

		continueButton.onDone(() => resolve(undefined));
		cancelButton.onDone(() => resolve(undefined));

		await this.client.registerInteractionCollector(continueButton);
		await this.client.registerInteractionCollector(cancelButton);
		await this.client.registerInteractionCollector(returnButton);
		await this.client.registerInteractionCollector(leaveButton);

		const strings = constants.contexts.failedToSubmitForm({
			localise: this.client.localise,
			locale: submission.locale,
		});

		this.client
			.editReply(submission, {
				embeds: [
					this.getErrorMessage(submission, { error }) ?? {
						title: strings.title,
						description: strings.description,
					},
				],
				components: [
					{
						type: Discord.MessageComponentTypes.ActionRow,
						components: [
							{
								type: Discord.MessageComponentTypes.Button,
								customId: continueButton.customId,
								label: strings.continue,
								style: Discord.ButtonStyles.Success,
							},
							{
								type: Discord.MessageComponentTypes.Button,
								customId: cancelButton.customId,
								label: strings.cancel,
								style: Discord.ButtonStyles.Danger,
							},
						],
					},
				],
			})
			.ignore();

		return promise;
	}

	async #dispatchSubmit(submission: Rost.Interaction, { formData }: { formData: FormData }): Promise<void> {
		this.#onSubmit?.(submission, { formData });
		await this.close();
	}

	onSubmit(callback: SubmitEvent<FormData>): void {
		this.#onSubmit = callback;
	}

	async open(): Promise<void> {
		this.#submissions.onInteraction(async (submission) => {
			const formData = ModalComposer.getFormData<FormData>(submission);
			if (formData === undefined) {
				this.client.log.warn("Could not get form data from modal composer.");
				return;
			}

			this.#formData = formData;

			const error = await this.validate({ formData: this.#formData });
			if (error !== undefined) {
				const newAnchor = await this.handleInvalid(submission, { error });
				if (newAnchor === undefined) {
					return;
				}

				this.anchor = newAnchor;

				await this.#display();
			}

			await this.#dispatchSubmit(submission, { formData: this.#formData });
		});

		await this.client.registerInteractionCollector(this.#submissions);

		await this.#display();
	}

	async close(): Promise<void> {
		this.#submissions.close();
	}
}

export { ModalComposer };
export type { Modal };
