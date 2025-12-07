import { CloudStatusContext } from '../../tree/cloudStatusTypes';

describe('CloudStatusContext', () => {
  it('should have ROOT context', () => {
    expect(CloudStatusContext.ROOT).toBe('cloudStatusRoot');
  });

  it('should have GROUP context', () => {
    expect(CloudStatusContext.GROUP).toBe('cloudStatusGroup');
  });

  it('should have COMPONENT context', () => {
    expect(CloudStatusContext.COMPONENT).toBe('cloudStatusComponent');
  });

  it('should have INCIDENTS_GROUP context', () => {
    expect(CloudStatusContext.INCIDENTS_GROUP).toBe('cloudStatusIncidentsGroup');
  });

  it('should have INCIDENT context', () => {
    expect(CloudStatusContext.INCIDENT).toBe('cloudStatusIncident');
  });

  it('should have MAINTENANCE_GROUP context', () => {
    expect(CloudStatusContext.MAINTENANCE_GROUP).toBe('cloudStatusMaintenanceGroup');
  });

  it('should have MAINTENANCE context', () => {
    expect(CloudStatusContext.MAINTENANCE).toBe('cloudStatusMaintenance');
  });

  it('should have ERROR context', () => {
    expect(CloudStatusContext.ERROR).toBe('cloudStatusError');
  });

  it('should be a readonly object with all expected keys', () => {
    const keys = Object.keys(CloudStatusContext);
    expect(keys).toContain('ROOT');
    expect(keys).toContain('GROUP');
    expect(keys).toContain('COMPONENT');
    expect(keys).toContain('INCIDENTS_GROUP');
    expect(keys).toContain('INCIDENT');
    expect(keys).toContain('MAINTENANCE_GROUP');
    expect(keys).toContain('MAINTENANCE');
    expect(keys).toContain('ERROR');
    expect(keys).toHaveLength(8);
  });
});
