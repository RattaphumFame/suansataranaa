"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParksService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const park_entity_1 = require("./park.entity");
let ParksService = class ParksService {
    constructor(parkRepository) {
        this.parkRepository = parkRepository;
    }
    async searchByDistrict(district) {
        let parks;
        try {
            parks = district
                ? await this.parkRepository.find({
                    where: { district: (0, typeorm_2.Like)(`%${district}%`) },
                    order: { name: 'ASC' },
                })
                : await this.parkRepository.find({ order: { name: 'ASC' } });
        }
        catch (error) {
            throw new common_1.InternalServerErrorException({
                message: 'ดึงข้อมูลจากฐานข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
                error: error.message,
            });
        }
        return {
            total: parks.length,
            district: district ?? 'ทั้งหมด',
            data: parks.map((park) => this.formatPark(park)),
        };
    }
    async getParkById(id) {
        let park;
        try {
            park = await this.parkRepository.findOne({ where: { id } });
        }
        catch (error) {
            throw new common_1.InternalServerErrorException({
                message: 'ดึงข้อมูลจากฐานข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
                error: error.message,
            });
        }
        if (!park) {
            throw new common_1.NotFoundException(`ไม่พบสวนสาธารณะ id=${id}`);
        }
        return this.formatPark(park);
    }
    async getDistricts() {
        const rows = await this.parkRepository
            .createQueryBuilder('park')
            .select('DISTINCT park.district', 'district')
            .orderBy('park.district', 'ASC')
            .getRawMany();
        return rows.map((row) => row.district);
    }
    formatPark(park) {
        return {
            id: park.id,
            name: park.name,
            district: park.district,
            areaRai: park.rai,
            openTime: park.openTime,
            closeTime: park.closeTime,
            facilities: {
                toilet: park.toilet === '/',
                sportsField: park.sportsField === '/',
                runningTrack: park.runningTrack === '/',
                carPark: park.carPark === '/',
                bicyclePath: park.bicyclePath === '/',
                other: park.otherFacility || null,
            },
        };
    }
};
exports.ParksService = ParksService;
exports.ParksService = ParksService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(park_entity_1.Park)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ParksService);
//# sourceMappingURL=parks.service.js.map