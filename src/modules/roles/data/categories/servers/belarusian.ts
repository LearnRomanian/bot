import { fromNames } from '../../../module.ts';
import { RoleCategory } from '../../structures/role-category.ts';

const categories: Partial<RoleCategory>[] = [
	{
		name: 'Regions',
		collection: {
			type: 'COLLECTION_LOCALISED',
			list: fromNames([
				'Brest / Брэсцкая',
				'Hrodna / Гродзенская',
				'Homel / Гомельская',
				'Mahilyow / Магілёўская',
				'Minsk / Мінская',
				'Vitsebsk / Вiцебская',
			]),
		},
	},
];

export default categories;
