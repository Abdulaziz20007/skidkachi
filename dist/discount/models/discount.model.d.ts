import { Model } from "sequelize-typescript";
interface IDiscountCreationAttr {
    store_id: number;
    title: string;
    description: string;
    discount_percent: number;
    start_date: Date;
    end_date: Date;
    category_id: number;
    discount_value: number;
    special_link: string;
    is_active: boolean;
    discount_type_id: number;
}
export declare class Discount extends Model<Discount, IDiscountCreationAttr> {
    id: number;
    store_id: number;
    title: string;
    description: string;
    discount_percent: number;
    start_date: Date;
    end_date: Date;
    category_id: number;
    discount_value: number;
    special_link: string;
    is_active: boolean;
    discount_type_id: number;
}
export {};
