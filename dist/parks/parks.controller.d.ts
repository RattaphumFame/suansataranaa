import { ParksService } from './parks.service';
export declare class ParksController {
    private readonly parksService;
    constructor(parksService: ParksService);
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
    getDistricts(): Promise<any[]>;
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
}
