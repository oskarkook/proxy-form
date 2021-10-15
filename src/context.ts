import { createContext } from 'react';
import { FieldPath, FormListener, FormOptions, RegistrationUpdater, UnsubscribeFn } from './types';

export interface ContextValue<TForm> {
  register: (fieldPaths: FieldPath[], onUpdate: RegistrationUpdater<TForm>) => UnsubscribeFn;
  listen: (updateFn: FormListener<TForm>) => UnsubscribeFn;
  getForm: () => TForm;
  update: (updateFn: (form: TForm) => TForm | void, options?: {validate?: boolean, notify?: boolean}) => void;
  trigger: () => void;
  defaultOptions?: FormOptions;
};

export const FormContext = createContext<ContextValue<unknown>>({
  register: () => () => {},
  listen: () => () => {},
  getForm: () => undefined,
  update: () => {},
  trigger: () => {},
});
