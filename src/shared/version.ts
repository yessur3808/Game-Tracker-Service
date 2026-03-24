import pkg from "../../package.json";

/**
 * The API schema version surfaced in GamesDoc responses.
 * Derived from the major component of package.json `version` so that
 * bumping the package version is the single place to manage this.
 *
 * Callers should treat an increment here as a potentially breaking change
 * to the response envelope shape.
 */
export const SCHEMA_VERSION: string = pkg.version.split(".")[0];
