import type { TFaqEntrySelect } from '@drizzle/schemas/automation.schema';
import { inject, injectable } from 'tsyringe';
import { FAQ_REPOSITORY_TOKEN } from '../constants/di';
import type { IFaqRepository, TFaqBody } from '../contracts/whatsapp.contract';
import { WhatsappNotFoundError } from '../errors/automation.errors';

/**
 * The FAQ base of the WhatsApp assistant (M04 stage 2): only active entries
 * reach the assistant, so an entry is approved by being active. Removing an
 * entry is a soft delete.
 */
@injectable()
export class FaqService {
	constructor(@inject(FAQ_REPOSITORY_TOKEN) private readonly repository: IFaqRepository) {}

	list(): Promise<TFaqEntrySelect[]> {
		return this.repository.list(true);
	}

	create(actorUserId: string, body: TFaqBody): Promise<TFaqEntrySelect> {
		return this.repository.create({ ...body, createdBy: actorUserId, updatedBy: actorUserId });
	}

	async update(actorUserId: string, id: string, body: TFaqBody): Promise<TFaqEntrySelect> {
		const updated = await this.repository.update(id, { ...body, updatedBy: actorUserId });
		if (!updated) throw new WhatsappNotFoundError('faq');
		return updated;
	}

	async remove(id: string): Promise<void> {
		if (!(await this.repository.softDelete(id))) throw new WhatsappNotFoundError('faq');
	}
}
