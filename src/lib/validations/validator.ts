export type ValidationResult<T> = { success: true; data: T } | { success: false; error: string };

export interface Schema<T> {
  safeParse(input: unknown): ValidationResult<T>;
  parse(input: unknown): T;
}

/** Omitted fields must stay omitted so partial updates never erase stored values. */
function optional<T>(schema: Schema<T>): Schema<T | undefined> {
  return {
    safeParse: (input) =>
      input == null ? { success: true, data: undefined } : schema.safeParse(input),
    parse(input) {
      const result = this.safeParse(input);
      if (!result.success) throw new ValidationError(result.error);
      return result.data;
    },
  };
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class StringSchemaBuilder implements Schema<string> {
  private minLength?: { len: number; msg?: string };
  private maxLength?: { len: number; msg?: string };
  private isTrim = false;
  private defaultValue?: string;

  min(len: number, msg?: string): this {
    this.minLength = { len, msg };
    return this;
  }

  max(len: number, msg?: string): this {
    this.maxLength = { len, msg };
    return this;
  }

  trim(): this {
    this.isTrim = true;
    return this;
  }

  optional(): Schema<string | undefined> {
    return optional(this);
  }

  default(val: string): this {
    this.defaultValue = val;
    return this;
  }

  safeParse(input: unknown): ValidationResult<string> {
    if (input === undefined || input === null) {
      if (this.defaultValue !== undefined) return { success: true, data: this.defaultValue };
      return { success: false, error: 'Ce champ est requis' };
    }

    if (typeof input !== 'string') {
      return { success: false, error: 'Une chaîne de caractères est requise' };
    }

    const val = this.isTrim ? input.trim() : input;
    if (this.minLength && val.length < this.minLength.len) {
      return {
        success: false,
        error: this.minLength.msg || `Au moins ${this.minLength.len} caractères requis`,
      };
    }
    if (this.maxLength && val.length > this.maxLength.len) {
      return {
        success: false,
        error: this.maxLength.msg || `Au maximum ${this.maxLength.len} caractères autorisés`,
      };
    }
    return { success: true, data: val };
  }

  parse(input: unknown): string {
    const res = this.safeParse(input);
    if (!res.success) throw new ValidationError(res.error);
    return res.data;
  }
}

export class BooleanSchemaBuilder implements Schema<boolean> {
  private defaultValue?: boolean;

  optional(): Schema<boolean | undefined> {
    return optional(this);
  }

  default(val: boolean): this {
    this.defaultValue = val;
    return this;
  }

  safeParse(input: unknown): ValidationResult<boolean> {
    if (input === undefined || input === null) {
      if (this.defaultValue !== undefined) return { success: true, data: this.defaultValue };
      return { success: false, error: 'Un booléen est requis' };
    }
    if (typeof input !== 'boolean') return { success: false, error: 'Un booléen est requis' };
    return { success: true, data: input };
  }

  parse(input: unknown): boolean {
    const res = this.safeParse(input);
    if (!res.success) throw new ValidationError(res.error);
    return res.data;
  }
}

export class NumberSchemaBuilder implements Schema<number> {
  private defaultValue?: number;

  optional(): Schema<number | undefined> {
    return optional(this);
  }

  default(val: number): this {
    this.defaultValue = val;
    return this;
  }

  safeParse(input: unknown): ValidationResult<number> {
    if (input === undefined || input === null) {
      if (this.defaultValue !== undefined) return { success: true, data: this.defaultValue };
      return { success: false, error: 'Un nombre est requis' };
    }
    if (typeof input !== 'number' || !Number.isFinite(input))
      return { success: false, error: 'Nombre invalide' };
    return { success: true, data: input };
  }

  parse(input: unknown): number {
    const res = this.safeParse(input);
    if (!res.success) throw new ValidationError(res.error);
    return res.data;
  }
}

export class ArraySchemaBuilder<T> implements Schema<T[]> {
  private defaultValue?: T[];
  private maxItems?: number;

  constructor(private readonly itemSchema: Schema<T>) {}

  optional(): Schema<T[] | undefined> {
    return optional(this);
  }

  default(val: T[]): this {
    this.defaultValue = val;
    return this;
  }

  max(count: number): this {
    this.maxItems = count;
    return this;
  }

  safeParse(input: unknown): ValidationResult<T[]> {
    if (input === undefined || input === null) {
      if (this.defaultValue !== undefined) return { success: true, data: [...this.defaultValue] };
      return { success: false, error: 'Une liste est requise' };
    }
    if (!Array.isArray(input)) {
      return { success: false, error: 'Une liste est requise' };
    }

    if (this.maxItems !== undefined && input.length > this.maxItems) {
      return { success: false, error: `Au maximum ${this.maxItems} éléments autorisés` };
    }
    const items = input;
    const result: T[] = [];
    for (let i = 0; i < items.length; i++) {
      const itemRes = this.itemSchema.safeParse(items[i]);
      if (!itemRes.success) {
        return { success: false, error: `Élément ${i + 1} invalide: ${itemRes.error}` };
      }
      result.push(itemRes.data);
    }
    return { success: true, data: result };
  }

  parse(input: unknown): T[] {
    const res = this.safeParse(input);
    if (!res.success) throw new ValidationError(res.error);
    return res.data;
  }
}

export class AnySchemaBuilder implements Schema<unknown> {
  optional(): this {
    return this;
  }

  safeParse(input: unknown): ValidationResult<unknown> {
    return { success: true, data: input };
  }

  parse(input: unknown): unknown {
    return input;
  }
}

export type InferShape<T extends Record<string, Schema<unknown>>> = {
  [K in keyof T]: T[K] extends Schema<infer U> ? U : never;
};

export class ObjectSchemaBuilder<T extends Record<string, Schema<unknown>>> implements Schema<
  InferShape<T>
> {
  constructor(private readonly shape: T) {}

  optional(): Schema<InferShape<T> | undefined> {
    return optional(this);
  }

  safeParse(input: unknown): ValidationResult<InferShape<T>> {
    if (input === undefined || input === null) {
      return { success: false, error: 'Un objet est requis' };
    }
    if (typeof input !== 'object' || Array.isArray(input)) {
      return { success: false, error: 'Un objet est requis' };
    }

    const raw = input as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    for (const key of Object.keys(this.shape)) {
      const fieldSchema = this.shape[key];
      const res = fieldSchema.safeParse(raw[key]);
      if (!res.success) {
        return { success: false, error: `Champ '${key}': ${res.error}` };
      }
      if (res.data !== undefined) {
        output[key] = res.data;
      }
    }
    return { success: true, data: output as InferShape<T> };
  }

  parse(input: unknown): InferShape<T> {
    const res = this.safeParse(input);
    if (!res.success) throw new ValidationError(res.error);
    return res.data;
  }
}

export const v = {
  string: () => new StringSchemaBuilder(),
  boolean: () => new BooleanSchemaBuilder(),
  number: () => new NumberSchemaBuilder(),
  array: <T>(itemSchema: Schema<T>) => new ArraySchemaBuilder<T>(itemSchema),
  object: <T extends Record<string, Schema<unknown>>>(shape: T) =>
    new ObjectSchemaBuilder<T>(shape),
  any: () => new AnySchemaBuilder(),
};
