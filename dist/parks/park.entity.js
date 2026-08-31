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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Park = void 0;
const typeorm_1 = require("typeorm");
let Park = class Park {
};
exports.Park = Park;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", Number)
], Park.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 255 }),
    __metadata("design:type", String)
], Park.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 100 }),
    __metadata("design:type", String)
], Park.prototype, "district", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], Park.prototype, "rai", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], Park.prototype, "ngan", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', {
        precision: 10,
        scale: 2,
        nullable: true,
        name: 'square_wa',
    }),
    __metadata("design:type", Number)
], Park.prototype, "squareWa", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 10, nullable: true, name: 'open_time' }),
    __metadata("design:type", String)
], Park.prototype, "openTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 10, nullable: true, name: 'close_time' }),
    __metadata("design:type", String)
], Park.prototype, "closeTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 5, nullable: true }),
    __metadata("design:type", String)
], Park.prototype, "toilet", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 5, nullable: true, name: 'sports_field' }),
    __metadata("design:type", String)
], Park.prototype, "sportsField", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 5, nullable: true, name: 'running_track' }),
    __metadata("design:type", String)
], Park.prototype, "runningTrack", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 5, nullable: true, name: 'car_park' }),
    __metadata("design:type", String)
], Park.prototype, "carPark", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 5, nullable: true, name: 'bicycle_path' }),
    __metadata("design:type", String)
], Park.prototype, "bicyclePath", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 255, nullable: true, name: 'other_facility' }),
    __metadata("design:type", String)
], Park.prototype, "otherFacility", void 0);
exports.Park = Park = __decorate([
    (0, typeorm_1.Entity)('bangkok_parks')
], Park);
//# sourceMappingURL=park.entity.js.map