import { Tenant } from "./Tenant";
import { User } from "./User";
import { Client } from "./Client";
import { GrainContract } from "./GrainContract";
import { Product } from "./Product";
import { ProductTable } from "./ProductTable";
import { Billing } from "./Billing";
import { Broker } from "./Broker";
import { TenantEmailSettings } from "./TenantEmailSettings";
import { TenantPdfSettings } from "./TenantPdfSettings";
import { Lead } from "./Lead";
import { ContractEmailLog } from "./ContractEmailLog";
import { AuditLog } from "./AuditLog";
import { UserSession } from "./UserSession";
import { ContractFixation } from "./ContractFixation";

export const entitiesDir = [Tenant, User, Client, GrainContract, Product, ProductTable, Billing, Broker, TenantEmailSettings, TenantPdfSettings, Lead, ContractEmailLog, AuditLog, UserSession, ContractFixation];
