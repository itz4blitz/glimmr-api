import { Test, TestingModule } from "@nestjs/testing";
import { HealthModule } from "./health.module";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";

describe("HealthModule", () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [HealthModule],
    }).compile();
  });

  describe("Module Configuration", () => {
    it("should be defined", () => {
      expect(HealthModule).toBeDefined();
    });

    it("should create module successfully", () => {
      expect(module).toBeDefined();
    });

    it("should have HealthController", () => {
      const controller = module.get<HealthController>(HealthController);
      expect(controller).toBeDefined();
    });

    it("should have HealthService", () => {
      const service = module.get<HealthService>(HealthService);
      expect(service).toBeDefined();
    });

    it("should wire controller and service together", async () => {
      const controller = module.get<HealthController>(HealthController);
      const service = module.get<HealthService>(HealthService);

      expect(controller).toBeDefined();
      expect(service).toBeDefined();

      const mockResponse = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      } as any;

      await controller.getHealth(mockResponse);
      const serviceResult = await service.getHealth();

      expect(mockResponse.json).toHaveBeenCalledWith(serviceResult);
    });
  });
});
