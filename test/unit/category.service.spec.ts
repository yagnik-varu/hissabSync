import { Test, TestingModule } from '@nestjs/testing';
import { CategoryService } from '../../src/modules/category/services/category.service';
import { CategoryRepository } from '../../src/modules/category/repositories/category.repository';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('CategoryService', () => {
  let service: CategoryService;
  let categoryRepo: jest.Mocked<CategoryRepository>;

  beforeEach(async () => {
    const mockCategoryRepo = {
      seedDefaultCategories: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        { provide: CategoryRepository, useValue: mockCategoryRepo },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
    categoryRepo = module.get(CategoryRepository);
  });

  describe('createCategory', () => {
    it('should create a category', async () => {
      categoryRepo.create.mockResolvedValue({ id: 'cat-1', name: 'Food' } as any);
      const res = await service.createCategory('room-1', 'Food');
      expect(res).toEqual({ id: 'cat-1', name: 'Food' });
      expect(categoryRepo.create).toHaveBeenCalledWith('room-1', 'Food');
    });

    it('should throw CATEGORY_NAME_DUPLICATE on P2002 error', async () => {
      categoryRepo.create.mockRejectedValue({ code: 'P2002' });
      await expect(service.createCategory('room-1', 'Food')).rejects.toThrow(ConflictException);
      await expect(service.createCategory('room-1', 'Food')).rejects.toMatchObject({
        response: { code: 'CATEGORY_NAME_DUPLICATE' },
      });
    });
  });

  describe('deleteCategory', () => {
    it('should delete a category', async () => {
      categoryRepo.delete.mockResolvedValue({} as any);
      await service.deleteCategory('room-1', 'cat-1');
      expect(categoryRepo.delete).toHaveBeenCalledWith('room-1', 'cat-1');
    });

    it('should throw CATEGORY_NOT_FOUND on P2025 error', async () => {
      categoryRepo.delete.mockRejectedValue({ code: 'P2025' });
      await expect(service.deleteCategory('room-1', 'cat-1')).rejects.toThrow(NotFoundException);
      await expect(service.deleteCategory('room-1', 'cat-1')).rejects.toMatchObject({
        response: { code: 'CATEGORY_NOT_FOUND' },
      });
    });

    it('should throw CATEGORY_IN_USE on P2003 error (ON DELETE RESTRICT)', async () => {
      categoryRepo.delete.mockRejectedValue({ code: 'P2003' });
      await expect(service.deleteCategory('room-1', 'cat-1')).rejects.toThrow(ConflictException);
      await expect(service.deleteCategory('room-1', 'cat-1')).rejects.toMatchObject({
        response: { code: 'CATEGORY_IN_USE' },
      });
    });
  });
});
