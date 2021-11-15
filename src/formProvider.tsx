import React, { useRef } from 'react';
import { ContextValue, FormContext, ProviderContext } from './context';
import { FormListener, FormOptions } from './types';

export interface FormProviderProps<TForm> {
  defaultValues: TForm;
  defaultOptions?: FormOptions;
  listeners?: FormListener<TForm>[];
  children?: React.ReactNode;
};
export const FormProvider = <TForm extends Record<string, any>>({ defaultValues, defaultOptions, listeners = [], children }: FormProviderProps<TForm>): React.ReactElement => {
  const context = useRef<ContextValue<TForm>>();

  if(context.current === undefined) {
    const providerContext = new ProviderContext<TForm>(defaultValues, listeners, defaultOptions);

    context.current = {
      getForm: providerContext.getForm.bind(providerContext),
      getChangedFields: providerContext.getChangedFields.bind(providerContext),
      register: providerContext.register.bind(providerContext),
      listen: providerContext.listen.bind(providerContext),
      update: providerContext.update.bind(providerContext),
      trigger: providerContext.trigger.bind(providerContext),
    };
  }

  return (
    <FormContext.Provider value={context.current as ContextValue<unknown>}>
      { children }
    </FormContext.Provider>
  );
}