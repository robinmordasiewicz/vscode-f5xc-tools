import {
  filterResource,
  getFilterOptionsForViewMode,
  CONSOLE_VIEW_OPTIONS,
  FULL_API_OPTIONS,
} from '../../utils/resourceFilter';

describe('resourceFilter', () => {
  describe('CONSOLE_VIEW_OPTIONS', () => {
    it('should have correct default options', () => {
      expect(CONSOLE_VIEW_OPTIONS.removeSystemFields).toBe(true);
      expect(CONSOLE_VIEW_OPTIONS.removeStatus).toBe(true);
      expect(CONSOLE_VIEW_OPTIONS.removeNullValues).toBe(true);
      expect(CONSOLE_VIEW_OPTIONS.removeEmptyStrings).toBe(true);
      expect(CONSOLE_VIEW_OPTIONS.removeEmptyArrays).toBe(false);
      expect(CONSOLE_VIEW_OPTIONS.removeEmptyObjects).toBe(false);
    });
  });

  describe('FULL_API_OPTIONS', () => {
    it('should have all options set to false', () => {
      expect(FULL_API_OPTIONS.removeSystemFields).toBe(false);
      expect(FULL_API_OPTIONS.removeStatus).toBe(false);
      expect(FULL_API_OPTIONS.removeNullValues).toBe(false);
      expect(FULL_API_OPTIONS.removeEmptyStrings).toBe(false);
      expect(FULL_API_OPTIONS.removeEmptyArrays).toBe(false);
      expect(FULL_API_OPTIONS.removeEmptyObjects).toBe(false);
    });
  });

  describe('getFilterOptionsForViewMode', () => {
    it('should return CONSOLE_VIEW_OPTIONS for console mode', () => {
      expect(getFilterOptionsForViewMode('console')).toBe(CONSOLE_VIEW_OPTIONS);
    });

    it('should return FULL_API_OPTIONS for full mode', () => {
      expect(getFilterOptionsForViewMode('full')).toBe(FULL_API_OPTIONS);
    });

    it('should return CONSOLE_VIEW_OPTIONS for unknown mode', () => {
      // TypeScript won't allow this normally, but testing runtime safety
      expect(getFilterOptionsForViewMode('unknown' as 'console')).toBe(CONSOLE_VIEW_OPTIONS);
    });
  });

  describe('filterResource', () => {
    describe('system fields', () => {
      it('should remove system fields with CONSOLE_VIEW_OPTIONS', () => {
        const resource = {
          metadata: { name: 'test' },
          spec: { value: 1 },
          create_form: { field: 'data' },
          replace_form: { field: 'data' },
          system_metadata: { uid: '123' },
          resource_version: 'v1',
          referring_objects: [],
          deleted_referred_objects: [],
          disabled_referred_objects: [],
        };

        const result = filterResource(resource, CONSOLE_VIEW_OPTIONS);

        expect(result).toHaveProperty('metadata');
        expect(result).toHaveProperty('spec');
        expect(result).not.toHaveProperty('create_form');
        expect(result).not.toHaveProperty('replace_form');
        expect(result).not.toHaveProperty('system_metadata');
        expect(result).not.toHaveProperty('resource_version');
        expect(result).not.toHaveProperty('referring_objects');
      });

      it('should keep system fields with FULL_API_OPTIONS', () => {
        const resource = {
          metadata: { name: 'test' },
          create_form: { field: 'data' },
          system_metadata: { uid: '123' },
        };

        const result = filterResource(resource, FULL_API_OPTIONS);

        expect(result).toHaveProperty('create_form');
        expect(result).toHaveProperty('system_metadata');
      });
    });

    describe('status field', () => {
      it('should remove status with CONSOLE_VIEW_OPTIONS', () => {
        const resource = {
          metadata: { name: 'test' },
          spec: {},
          status: [{ condition: 'ready' }],
        };

        const result = filterResource(resource, CONSOLE_VIEW_OPTIONS);

        expect(result).not.toHaveProperty('status');
      });

      it('should keep status with FULL_API_OPTIONS', () => {
        const resource = {
          metadata: { name: 'test' },
          status: [{ condition: 'ready' }],
        };

        const result = filterResource(resource, FULL_API_OPTIONS);

        expect(result).toHaveProperty('status');
      });
    });

    describe('null values', () => {
      it('should remove null values with removeNullValues: true', () => {
        const resource = {
          name: 'test',
          value: null,
          nested: { inner: null, keep: 'value' },
        };

        const result = filterResource(resource, {
          ...FULL_API_OPTIONS,
          removeNullValues: true,
        });

        expect(result).toHaveProperty('name');
        expect(result).not.toHaveProperty('value');
        expect((result.nested as Record<string, unknown>).keep).toBe('value');
        expect(result.nested).not.toHaveProperty('inner');
      });

      it('should keep null values with removeNullValues: false', () => {
        const resource = {
          name: 'test',
          value: null,
        };

        const result = filterResource(resource, FULL_API_OPTIONS);

        expect(result.value).toBeNull();
      });
    });

    describe('empty strings', () => {
      it('should remove empty strings with removeEmptyStrings: true', () => {
        const resource = {
          name: 'test',
          empty: '',
          nested: { inner: '', keep: 'value' },
        };

        const result = filterResource(resource, {
          ...FULL_API_OPTIONS,
          removeEmptyStrings: true,
        });

        expect(result).not.toHaveProperty('empty');
        expect(result.nested).not.toHaveProperty('inner');
      });

      it('should keep empty strings with removeEmptyStrings: false', () => {
        const resource = {
          name: 'test',
          empty: '',
        };

        const result = filterResource(resource, FULL_API_OPTIONS);

        expect(result.empty).toBe('');
      });
    });

    describe('empty arrays', () => {
      it('should remove empty arrays with removeEmptyArrays: true', () => {
        const resource = {
          name: 'test',
          items: [],
          data: [1, 2],
        };

        const result = filterResource(resource, {
          ...FULL_API_OPTIONS,
          removeEmptyArrays: true,
        });

        expect(result).not.toHaveProperty('items');
        expect(result.data).toEqual([1, 2]);
      });

      it('should keep empty arrays with removeEmptyArrays: false', () => {
        const resource = {
          name: 'test',
          items: [],
        };

        const result = filterResource(resource, FULL_API_OPTIONS);

        expect(result.items).toEqual([]);
      });
    });

    describe('empty objects', () => {
      it('should remove empty objects with removeEmptyObjects: true', () => {
        const resource = {
          name: 'test',
          config: {},
          data: { value: 1 },
        };

        const result = filterResource(resource, {
          ...FULL_API_OPTIONS,
          removeEmptyObjects: true,
        });

        expect(result).not.toHaveProperty('config');
        expect(result.data).toEqual({ value: 1 });
      });

      it('should keep empty objects with removeEmptyObjects: false', () => {
        const resource = {
          name: 'test',
          config: {},
        };

        const result = filterResource(resource, FULL_API_OPTIONS);

        expect(result.config).toEqual({});
      });
    });

    describe('metadata filtering', () => {
      it('should remove empty description from metadata', () => {
        const resource = {
          metadata: {
            name: 'test',
            description: '',
            namespace: 'default',
          },
        };

        const result = filterResource(resource, CONSOLE_VIEW_OPTIONS);

        expect(result.metadata).toEqual({
          name: 'test',
          namespace: 'default',
        });
      });

      it('should remove null description from metadata', () => {
        const resource = {
          metadata: {
            name: 'test',
            description: null,
            namespace: 'default',
          },
        };

        const result = filterResource(resource, CONSOLE_VIEW_OPTIONS);

        expect(result.metadata).toEqual({
          name: 'test',
          namespace: 'default',
        });
      });

      it('should keep non-empty description in metadata', () => {
        const resource = {
          metadata: {
            name: 'test',
            description: 'A test resource',
          },
        };

        const result = filterResource(resource, CONSOLE_VIEW_OPTIONS);

        expect((result.metadata as Record<string, unknown>).description).toBe('A test resource');
      });
    });

    describe('nested objects', () => {
      it('should recursively filter nested objects', () => {
        const resource = {
          spec: {
            config: {
              value: null,
              name: 'test',
              deep: {
                empty: '',
                data: 'value',
              },
            },
          },
        };

        const result = filterResource(resource, CONSOLE_VIEW_OPTIONS);

        const spec = result.spec as Record<string, unknown>;
        const config = spec.config as Record<string, unknown>;
        expect(config).not.toHaveProperty('value');
        expect(config.name).toBe('test');
        expect((config.deep as Record<string, unknown>).data).toBe('value');
        expect(config.deep).not.toHaveProperty('empty');
      });
    });

    describe('arrays with objects', () => {
      it('should filter objects within arrays', () => {
        const resource = {
          items: [
            { name: 'item1', empty: '' },
            { name: 'item2', value: null },
          ],
        };

        const result = filterResource(resource, CONSOLE_VIEW_OPTIONS);

        const items = result.items as Array<Record<string, unknown>>;
        expect(items).toHaveLength(2);
        expect(items[0]).toEqual({ name: 'item1' });
        expect(items[1]).toEqual({ name: 'item2' });
      });

      it('should filter null items from arrays', () => {
        const resource = {
          items: ['value', null, 'another'],
        };

        const result = filterResource(resource, CONSOLE_VIEW_OPTIONS);

        expect(result.items).toEqual(['value', 'another']);
      });
    });

    describe('default options', () => {
      it('should use CONSOLE_VIEW_OPTIONS by default', () => {
        const resource = {
          metadata: { name: 'test', description: '' },
          create_form: {},
          status: [],
          spec: { value: null },
        };

        const result = filterResource(resource);

        expect(result).not.toHaveProperty('create_form');
        expect(result).not.toHaveProperty('status');
        expect(result.spec).toEqual({});
        expect(result.metadata).toEqual({ name: 'test' });
      });
    });
  });
});
