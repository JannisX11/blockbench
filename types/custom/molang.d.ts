declare class Molang {
	parse(expression: string | number, variables?: Record<string, number>): number
	global_variables: Record<string, string | number | ((...args: number[]) => number)>
	variableHandler: (variable: string, variables?: Record<string, number>) => number
}

declare interface MolangExpression {
	animation: _Animation
	animator: BoneAnimator
	channel: string
	key: string
	kf: _Keyframe
	type: string
	value: string
}

declare function getAllMolangExpressions(): MolangExpression[]

declare namespace MolangAutocomplete {
	/** Represents the result of a Molang autocomplete operation. */
	interface MolangAutocompleteResult {
		/** The text to insert. */
		text: string
		/** The label to display in the autocomplete menu. */
		label?: string
		/** The number of characters to overlap with the incomplete string. */
		overlap: number
		/** The suggestion priority. A higher number means it will be suggested first. */
		priority?: number
	}

	/** Represents a root token. */
	interface RootToken {
		/** The ID of the new root token. */
		id: string
		/** The arguments of the root token. */
		arguments?: string[]
		/** The suggestion priority of the root token. A higher number means it will be suggested first. */
		priority?: number
	}

	/** Represents a query. */
	interface Query {
		/** The ID of the new query. */
		id: string
		/** The arguments of the query. */
		arguments?: string[]
		/** The suggestion priority of the query. A higher number means it will be suggested first. */
		priority?: number
	}

	/** Represents the options for a namespace. */
	interface NamespaceOptions {
		/** The ID of the new namespace. */
		id: string
		/** The shorthand of the new namespace. Eg. `q` for `query`. */
		shorthand?: string
		/** The suggestion priority of the namespace. A higher number means it will be suggested first. */
		priority?: number
	}

	/** Represents the options for a namespace union. */
	interface NamespaceUnionOptions {
		/** The ID of the new namespace. */
		id: string
		/** The shorthand of the new namespace. Eg. `q` for `query`. */
		shorthand?: string
		/** The suggestion priority of the namespace. A higher number means it will be suggested first. */
		priority?: number
	}

	class Namespace {
		/** The ID of the namespace. */
		id: string
		/** The shorthand of the namespace. */
		shorthand: string
		/** The queries in the namespace. */
		queries: Map<string, Query>
		/** The query getters in the namespace. */
		queryGetters: Map<string, () => Query[]>
		/** Creates a new namespace. */
		constructor(options: NamespaceOptions)
		/** Adds a new query to the namespace. */
		addQuery(query: Query): Namespace
		/** Checks if the namespace has a query. */
		hasQuery(queryID: string): boolean
		/** Removes a query from the namespace. */
		removeQuery(queryID: string): boolean
		/** Adds a getter function that returns dynamically generated queries. */
		addQueryGetter(id: string, getter: (incomplete: string) => Query[]): Namespace
		/** Removes a query getter function. */
		removeQueryGetter(id: string): void
		/** Creates a new namespace that is a union of this namespace and another. */
		createUnion(other: Namespace, options?: NamespaceUnionOptions): Namespace
		/** Returns any queries in this namespace who's ID starts with `incomplete`. */
		getPossibleQueries(expression: string, incomplete: string, recursive?: boolean): Query[]
	}

	/** Represents the options for a context. */
	interface MolangAutocompleteContextOptions {
		/** The ID of the new context. */
		id: string
		/** The root tokens in the new context. */
		rootTokens?: RootToken[]
		/** The inherited context. */
		inheritedContext?: Context
	}

	class Context {
		/** All contexts. */
		static all: Context[]
		/** The ID of the context. */
		id: string
		/** The root tokens in the context. */
		rootTokens: Map<string, RootToken>
		/** The namespaces in the context. */
		namespaces: Map<string, Namespace>
		/** The inherited context. */
		inheritedContext: Context
		/** Creates a new context. */
		constructor(options: MolangAutocompleteContextOptions)
		/** Adds a new root token to the context. */
		addRootToken(token: RootToken): Context
		/** Gets a root token. */
		getRootToken(tokenID: string): RootToken
		/** Removes a root token from the context. */
		removeRootToken(tokenID: string): boolean
		/** Checks if the context has a namespace. */
		hasNamespace(namespaceID: string, recursive?: boolean): boolean
		/** Adds a new namespace to the context. */
		addNamespace(namespace: Namespace, createUnion?: boolean): Context
		/** Gets a namespace. */
		getNamespace(namespaceID: string, recursive?: boolean): Namespace
		/** Removes a namespace from the context. */
		removeNamespace(namespaceID: string): boolean
		/** Returns any namespaces in this context who's ID starts with `incomplete`. */
		getPossibleNamespaces(incomplete: string, recursive?: boolean): Namespace[]
		/** Returns any root tokens in this context who's ID starts with `incomplete`. */
		getPossibleRootTokens(incomplete: string, recursive?: boolean): RootToken[]
		/** Attempts to autocomplete the given text from the given position in the text. */
		autocomplete(text: string, position: number): MolangAutocompleteResult[]
		/** Removes the context from the list of all contexts. */
		delete(): void
	}

	/** The default context. */
	const DefaultContext: Context
	/** Keyframe Molang Auto-complete Context */
	const KeyframeContext: Context
	/** Animation Controller Molang Auto-complete Context */
	const AnimationControllerContext: Context
	/** Animation Molang Auto-complete Context */
	const AnimationContext: Context
	/** Variable Placeholders Molang Auto-complete Context */
	const VariablePlaceholdersContext: Context
	/** Bedrock Binding Molang Auto-complete Context */
	const BedrockBindingContext: Context
}
