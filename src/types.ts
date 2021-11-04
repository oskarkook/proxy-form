import { Patch } from 'immer';

// Generic
export type FieldName = string | symbol | number;
export type FieldPath = Array<FieldName>;

export type ChangeEvent = {
  target: any;
  type?: any;
};

// Form
export interface FormOptions {
  controlled?: boolean;
  mode?: 'onChange' | 'onBlur';
}

export type UnsubscribeFn = () => void;
export type RegistrationUpdater<TForm> = (form: TForm) => void;
export type FormListener<TForm> = (props: {
  form: TForm,
  patch: Patch,
  changed: (fieldPath: FieldPath) => boolean,
}) => TForm | void;

export interface FieldHelpers<TValue, TSource> {
  name: string;
  value: TValue;
  onChange: (data: ChangeEvent | TSource) => void;
  onBlur: () => void;
};
