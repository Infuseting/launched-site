export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface Schema<T> {
  safeParse(input: unknown): ValidationResult<T>;
  parse(input: unknown): T;
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
  private isOptional = false;
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

  optional(): StringSchemaBuilder {
    this.isOptional = true;
    return this;
  }

  default(val: string): this {
    this.defaultValue = val;
    return this;
  }

  safeParse(input: unknown): ValidationResult<string> {
    if (input === undefined || input === null) {
      if (this.defaultValue !== undefined) return { success: true, data: this.defaultValue };
      if (this.isOptional) return { success: true, data: '' };
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
  private isOptional = false;
  private defaultValue?: boolean;

  optional(): this {
    this.isOptional = true;
    return this;
  }

  default(val: boolean): this {
    this.defaultValue = val;
    return this;
  }

  safeParse(input: unknown): ValidationResult<boolean> {
    if (input === undefined || input === null) {
      if (this.defaultValue !== undefined) return { success: true, data: this.defaultValue };
      if (this.isOptional) return { success: true, data: false };
      return { success: false, error: 'Un booléen est requis' };
    }
    return { success: true, data: Boolean(input) };
  }

  parse(input: unknown): boolean {
    const res = this.safeParse(input);
    if (!res.success) throw new ValidationError(res.error);
    return res.data;
  }
}

export class NumberSchemaBuilder implements Schema<number> {
  private isOptional = false;
  private defaultValue?: number;

  optional(): this {
    this.isOptional = true;
    return this;
  }

  default(val: number): this {
    this.defaultValue = val;
    return this;
  }

  safeParse(input: unknown): ValidationResult<number> {
    if (input === undefined || input === null) {
      if (this.defaultValue !== undefined) return { success: true, data: this.defaultValue };
      if (this.isOptional) return { success: true, data: 0 };
      return { success: false, error: 'Un nombre est requis' };
    }
    const num = Number(input);
    if (Number.isNaN(num)) return { success: false, error: 'Nombre invalide' };
    return { success: true, data: num };
  }

  parse(input: unknown): number {
    const res = this.safeParse(input);
    if (!res.success) throw new ValidationError(res.error);
    return res.data;
  }
}

export class ArraySchemaBuilder<T> implements Schema<T[]> {
  private isOptional = false;
  private defaultValue?: T[];
  private maxItems?: number;

  constructor(private readonly itemSchema: Schema<T>) {}

  optional(): this {
    this.isOptional = true;
    return this;
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
      if (this.defaultValue !== undefined) return { success: true, data: this.defaultValue };
      if (this.isOptional) return { success: true, data: [] };
      return { success: false, error: 'Une liste est requise' };
    }
    if (!Array.isArray(input)) {
      return { success: false, error: 'Une liste est requise' };
    }

    const items = this.maxItems !== undefined ? input.slice(0, this.maxItems) : input;
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

export class AnySchemaBuilder implements Schema<any> {
  optional(): this {
    return this;
  }

  safeParse(input: unknown): ValidationResult<any> {
    return { success: true, data: input };
  }

  parse(input: unknown): any {
    return input;
  }
}

export type InferShape<T extends Record<string, Schema<any>>> = {
  [K in keyof T]: T[K] extends Schema<infer U> ? U : never;
};

export class ObjectSchemaBuilder<T extends Record<string, Schema<any>>>
  implements Schema<InferShape<T>>
{
  private isOptional = false;

  constructor(private readonly shape: T) {}

  optional(): this {
    this.isOptional = true;
    return this;
  }

  safeParse(input: unknown): ValidationResult<InferShape<T>> {
    if (input === undefined || input === null) {
      if (this.isOptional) return { success: true, data: {} as InferShape<T> };
      return { success: false, error: 'Un objet est requis' };
    }
    if (typeof input !== 'object') {
      return { success: false, error: 'Un objet est requis' };
    }

    const raw = input as Record<string, unknown>;
    const output = {} as InferShape<T>;

    for (const key of Object.keys(this.shape)) {
      const fieldSchema = this.shape[key];
      const res = fieldSchema.safeParse(raw[key]);
      if (!res.success) {
        return { success: false, error: `Champ '${key}': ${res.error}` };
      }
      if (res.data !== undefined) {
        output[key as keyof T] = res.data;
      }
    }
    return { success: true, data: output };
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
  object: <T extends Record<string, Schema<any>>>(shape: T) =>
    new ObjectSchemaBuilder<T>(shape),
  any: () => new AnySchemaBuilder(),
};
