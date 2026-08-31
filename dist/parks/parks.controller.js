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
exports.ParksController = void 0;
const common_1 = require("@nestjs/common");
const parks_service_1 = require("./parks.service");
let ParksController = class ParksController {
    constructor(parksService) {
        this.parksService = parksService;
    }
    searchByDistrict(district) {
        return this.parksService.searchByDistrict(district);
    }
    getDistricts() {
        return this.parksService.getDistricts();
    }
    getParkById(id) {
        return this.parksService.getParkById(id);
    }
};
exports.ParksController = ParksController;
__decorate([
    (0, common_1.Get)('search'),
    __param(0, (0, common_1.Query)('district')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ParksController.prototype, "searchByDistrict", null);
__decorate([
    (0, common_1.Get)('districts'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ParksController.prototype, "getDistricts", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], ParksController.prototype, "getParkById", null);
exports.ParksController = ParksController = __decorate([
    (0, common_1.Controller)('parks'),
    __metadata("design:paramtypes", [parks_service_1.ParksService])
], ParksController);
//# sourceMappingURL=parks.controller.js.map