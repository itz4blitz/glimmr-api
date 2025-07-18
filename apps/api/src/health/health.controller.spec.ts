import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let service: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    service = module.get<HealthService>(HealthService);
  });

  describe('getHealth', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should return health status', async () => {
      const result = await controller.getHealth();
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should call HealthService.getHealth()', async () => {
      const getHealthSpy = jest.spyOn(service, 'getHealth');
      await controller.getHealth();
      expect(getHealthSpy).toHaveBeenCalled();
    });

    it('should return the same value as HealthService.getHealth()', async () => {
      const serviceResult = await service.getHealth();
      const controllerResult = await controller.getHealth();
      expect(controllerResult).toEqual(serviceResult);
    });
  });

  describe('API documentation', () => {
    it('should be decorated with @ApiTags', () => {
      const metadata = Reflect.getMetadata('swagger/apiUseTags', HealthController);
      expect(metadata).toBeDefined();
      expect(metadata).toContain('health');
    });

    it('should have proper route mapping', () => {
      const routeMetadata = Reflect.getMetadata('path', HealthController);
      expect(routeMetadata).toBeDefined();
    });

    it('should have @ApiOperation decorator on getHealth method', () => {
      const operationMetadata = Reflect.getMetadata('swagger/apiOperation', controller.getHealth);
      expect(operationMetadata).toBeDefined();
    });

    it('should have @ApiResponse decorator on getHealth method', () => {
      const responseMetadata = Reflect.getMetadata('swagger/apiResponse', controller.getHealth);
      expect(responseMetadata).toBeDefined();
    });
  });
});