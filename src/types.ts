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
  mode?: 'onChange' | 'onBlur';
}

export type UnsubscribeFn = () => void;
export type RegistrationUpdater<TForm> = (form: TForm) => void;
export type FormListener<TForm> = (props: {
  form: TForm,
  patch: Patch,
  changed: (fieldPath: FieldPath) => boolean,
}) => TForm | void;