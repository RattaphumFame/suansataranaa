"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParksModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const parks_controller_1 = require("./parks.controller");
const parks_service_1 = require("./parks.service");
const park_entity_1 = require("./park.entity");
let ParksModule = class ParksModule {
};
exports.ParksModule = ParksModule;
exports.ParksModule = ParksModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([park_entity_1.Park])],
        controllers: [parks_controller_1.ParksController],
        providers: [parks_service_1.ParksService],
    })
], ParksModule);
//# sourceMappingURL=parks.module.js.map