import type { Collection } from "rost:constants/database";
import type { WithRequired } from "rost:core/utilities";
import type * as ravendb from "ravendb";

interface RavenDBDocumentMetadataContainer {
	"@metadata": RavenDBDocumentMetadata;
}

interface RavenDBDocumentMetadata extends WithRequired<ravendb.MetadataObject, "@id"> {
	readonly "@id": string;
	readonly "@collection": Collection;
	"@is-deleted"?: boolean;
}

interface RavenDBDocument extends RavenDBDocumentMetadataContainer {
	[key: string]: unknown;
}

export type { RavenDBDocument, RavenDBDocumentMetadata, RavenDBDocumentMetadataContainer };
