import { Repository } from 'typeorm';
import { Park } from './park.entity';
export declare class ParksService {
    private readonly parkRepository;
    constructor(parkRepository: Repository<Park>);
    searchByDistrict(district?: string): Promise<{
        total: number;
        district: string;
        data: {
            id: number;
            name: string;
            district: string;
            areaRai: number;
            openTime: string;
            closeTime: string;
            facilities: {
                toilet: boolean;
                sportsField: boolean;
                runningTrack: boolean;
                carPark: boolean;
                bicyclePath: boolean;
                other: string | null;
            };
        }[];
    }>;
    getParkById(id: number): Promise<{
        id: number;
        name: string;
        district: string;
        areaRai: number;
        openTime: string;
        closeTime: string;
        facilities: {
            toilet: boolean;
            sportsField: boolean;
            runningTrack: boolean;
            carPark: boolean;
            bicyclePath: boolean;
            other: string | null;
        };
    }>;
    getDistricts(): Promise<any[]>;
    private formatPark;
}
