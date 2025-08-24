# Blockbench Typescript Types!

## Generated types
All type definitions in the folder /generated/ are auto-generated from the Blockbench source.
All exports are converted to global declarations.
To exclude source files from generating types, add them to the "exclude" list in type_config.json.
To exclude individual exports, use the typescript @private flag.

## Custom types
All type definitions in the /custom/ folder are manually written and are intended to provide types for old files that are still in Javascript.


## Generating types
Run `npm run generate-types` from the main repo. Ensure typescript throws no errors, otherwise files won't export correctly.

## Locally testing and using types
To use these types in other projects on your local PC before they are published, run this command in your other project:

`npm install "C:/path/to/blockbench/types"`

Where the path leads to this /types/ folder in the Blockbench repository.

## Publishing types

`npm run publish-types --dry-run`

`npm run publish-types --tag beta`

`npm run publish-types`

