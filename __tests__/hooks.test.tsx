/**
 * @jest-environment jsdom
 */

import React from 'react';
import { FormProvider } from '../src/formProvider';
import { useForm, UseForm } from '../src/hooks';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

describe('useForm', () => {
  it('will update with nested values', () => {
    interface Form {
      name: string;
      items: Array<{id: number, text: string}>;
    };

    const ItemForm: React.FC<{index: number}> = ({ index }) => (
      <>
        <UseForm<Form> render={({ form }) => (
          <span>{form.items[index].id}</span>
        )}/>
        <UseForm<Form> render={({ form, field }) => (
          <input data-testid={`item-id-${form.items[index].id}`} {...field(form.items[index].text)}/>
        )}/>
      </>
    );

    const TestForm = () => {
      const { form, field } = useForm<Form>();

      return (
        <>
          <input data-testid='form-name' {...field(form.name)}/>
          {form.items.map((item, i) => (
            <ItemForm key={item.id} index={i}/>
          ))}
        </>
      );
    };

    render(
      <FormProvider defaultValues={{
        name: 'test',
        items: [
          { id: 1, text: 'something' },
          { id: 2, text: 'something else' },
        ]
      }}>
        <TestForm/>
      </FormProvider>
    );

    const formNameInput = screen.getByTestId<HTMLInputElement>('form-name');
    expect(formNameInput.value).toBe('test');

    fireEvent.change(formNameInput, { target: { value: 'new name' } });
    expect(formNameInput.value).toBe('new name');

    const itemTextInput = screen.getByTestId<HTMLInputElement>('item-id-1');
    expect(itemTextInput.value).toBe('something');

    fireEvent.change(itemTextInput, { target: { value: 'something else' } });
    expect(itemTextInput.value).toBe('something else');
  });

  describe('field', () => {
    it('keeps the same value over re-renders', () => {
      interface Form {
        name: string;
      }
  
      const TestForm = () => {
        const [localName, setLocalName] = React.useState('test');
        const { form, field, update } = useForm<Form>();
  
        return (
          <div>
            <input {...field(form.name)}/>
            <button onClick={() => {
              update(f => {
                f.name = 'new name';
              }, {notify: false});
              setLocalName('new name');
            }}>
              Update
            </button>
          </div>
        );
      };
  
      render(
        <FormProvider defaultValues={{ name: 'test' }}>
          <TestForm/>
        </FormProvider>
      );
  
      expect(screen.queryByDisplayValue('test')).toBeInTheDocument();
  
      const button = screen.getByText('Update');
      fireEvent.click(button);
  
      expect(screen.queryByDisplayValue('new name')).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue('test')).toBeInTheDocument();
    });
  });

});