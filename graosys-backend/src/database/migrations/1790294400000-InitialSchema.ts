import { MigrationInterface, QueryRunner } from "typeorm";

// Esquema completo em 2026-09-25. Só roda em banco vazio: onde a tabela "tenants" já existe
// (produção), o esquema atual é preservado e a migration seguinte completa o que faltar.
const SCHEMA_SQL = String.raw`
CREATE TABLE public.billings (
    id character varying NOT NULL,
    tenant_id character varying NOT NULL,
    number_contract character varying NOT NULL,
    number_broker character varying NOT NULL,
    product_name character varying NOT NULL,
    year character varying NOT NULL,
    receipt_date character varying,
    internal_receipt_number character varying,
    rps_number character varying,
    nfs_number character varying,
    total_service_value numeric(15,4) NOT NULL,
    irrf_value numeric(15,4) DEFAULT '0'::numeric NOT NULL,
    adjustment_value numeric(15,4) DEFAULT '0'::numeric NOT NULL,
    liquid_value numeric(15,4) NOT NULL,
    expected_receipt_date character varying,
    liquid_contract_date character varying,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    owner_record character varying,
    observation character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.brokers (
    id character varying NOT NULL,
    tenant_id character varying NOT NULL,
    name character varying NOT NULL,
    cnpj_cpf character varying,
    email character varying,
    phone character varying,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.clients (
    id character varying NOT NULL,
    tenant_id character varying NOT NULL,
    code_client integer NOT NULL,
    nickname character varying NOT NULL,
    name character varying NOT NULL,
    address character varying,
    number character varying,
    complement character varying,
    district character varying,
    city character varying,
    state character varying,
    zip_code character varying,
    kind character varying NOT NULL,
    cnpj_cpf character varying NOT NULL,
    ins_est character varying,
    ins_mun character varying,
    telephone character varying,
    cellphone character varying,
    situation character varying DEFAULT 'active'::character varying NOT NULL,
    account jsonb DEFAULT '[]'::jsonb,
    contacts jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    country character varying DEFAULT 'Brasil'::character varying NOT NULL
);

CREATE SEQUENCE public.clients_code_client_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.clients_code_client_seq OWNED BY public.clients.code_client;

CREATE TABLE public.contract_email_logs (
    id character varying NOT NULL,
    tenant_id character varying NOT NULL,
    contract_id character varying NOT NULL,
    party character varying NOT NULL,
    party_names text,
    recipients jsonb DEFAULT '[]'::jsonb NOT NULL,
    subject character varying,
    copy_correct boolean DEFAULT false NOT NULL,
    status character varying DEFAULT 'sent'::character varying NOT NULL,
    error text,
    sent_by_id character varying,
    sent_by_name character varying,
    sent_by_email character varying,
    sent_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.grain_contracts (
    id character varying NOT NULL,
    tenant_id character varying NOT NULL,
    number_broker character varying NOT NULL,
    number_contract character varying NOT NULL,
    seller jsonb DEFAULT '[]'::jsonb,
    buyer jsonb DEFAULT '[]'::jsonb,
    list_email_seller jsonb DEFAULT '[]'::jsonb,
    list_email_buyer jsonb DEFAULT '[]'::jsonb,
    product character varying NOT NULL,
    name_product character varying NOT NULL,
    crop character varying NOT NULL,
    quality character varying,
    type_quantity character varying,
    quantity numeric(15,4) NOT NULL,
    quantity_kg numeric(15,4),
    quantity_bag numeric(15,4),
    type_currency character varying NOT NULL,
    price numeric(15,4) NOT NULL,
    type_icms character varying,
    icms character varying,
    payment character varying,
    type_commission_seller character varying,
    commission_seller character varying,
    type_commission_buyer character varying,
    commission_buyer character varying,
    type_pickup character varying,
    pickup character varying,
    pickup_location character varying,
    inspection character varying,
    observation character varying,
    internal_communication character varying,
    destination character varying,
    complement_destination character varying,
    number_external_contract_buyer character varying,
    number_external_contract_seller character varying,
    day_exchange_rate character varying,
    payment_date character varying,
    initial_pickup_date character varying,
    final_pickup_date character varying,
    contract_emission_date character varying,
    owner_contract character varying,
    total_contract_value numeric(15,4),
    commission_contract numeric(15,4),
    commission_seller_contract_value numeric(15,4),
    commission_buyer_contract_value numeric(15,4),
    total_received numeric(15,4),
    status_received character varying,
    expected_receipt_date character varying,
    status jsonb,
    table_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.leads (
    id character varying NOT NULL,
    name character varying NOT NULL,
    region character varying,
    status character varying DEFAULT 'a_contatar'::character varying NOT NULL,
    probable_plan character varying,
    phones jsonb DEFAULT '[]'::jsonb NOT NULL,
    email character varying,
    address character varying,
    cnpj character varying,
    corporate_name character varying,
    site character varying,
    hook text,
    decision_maker character varying,
    whatsapp character varying,
    next_step character varying,
    next_step_date date,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.product_tables (
    id character varying NOT NULL,
    tenant_id character varying NOT NULL,
    name character varying NOT NULL,
    product character varying NOT NULL,
    crop character varying NOT NULL,
    description character varying,
    prices jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.products (
    id character varying NOT NULL,
    tenant_id character varying NOT NULL,
    product_type character varying NOT NULL,
    name character varying NOT NULL,
    commission_seller character varying,
    type_commission_seller character varying,
    quality text,
    observation text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.tenant_email_settings (
    id character varying NOT NULL,
    tenant_id character varying NOT NULL,
    smtp_host character varying NOT NULL,
    smtp_port integer DEFAULT 587 NOT NULL,
    smtp_secure boolean DEFAULT false NOT NULL,
    smtp_user character varying NOT NULL,
    smtp_pass_encrypted text NOT NULL,
    from_name character varying,
    from_email character varying,
    bcc_emails jsonb DEFAULT '[]'::jsonb,
    signature text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.tenant_pdf_settings (
    id character varying NOT NULL,
    tenant_id character varying NOT NULL,
    logo_data text,
    logo_position character varying DEFAULT 'left'::character varying NOT NULL,
    logo_width integer DEFAULT 120 NOT NULL,
    watermark_data text,
    watermark_opacity double precision DEFAULT '0.1'::double precision NOT NULL,
    watermark_enabled boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.tenants (
    id character varying NOT NULL,
    slug character varying NOT NULL,
    name character varying NOT NULL,
    cnpj character varying,
    email character varying,
    phone character varying,
    status character varying DEFAULT 'active'::character varying NOT NULL,
    plan character varying DEFAULT 'trial'::character varying NOT NULL,
    plan_expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.users (
    id character varying NOT NULL,
    tenant_id character varying NOT NULL,
    name character varying NOT NULL,
    email character varying NOT NULL,
    password character varying NOT NULL,
    role character varying DEFAULT 'user'::character varying NOT NULL,
    permissions jsonb DEFAULT '{}'::jsonb,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    last_login_at timestamp without time zone
);

ALTER TABLE ONLY public.clients ALTER COLUMN code_client SET DEFAULT nextval('public.clients_code_client_seq'::regclass);

ALTER TABLE ONLY public.grain_contracts
    ADD CONSTRAINT "PK_075c65a56ebfe86ff8f57a7d8cd" PRIMARY KEY (id);

ALTER TABLE ONLY public.products
    ADD CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY (id);

ALTER TABLE ONLY public.tenant_pdf_settings
    ADD CONSTRAINT "PK_1997ad461890c9bdc3c680fc2d7" PRIMARY KEY (id);

ALTER TABLE ONLY public.tenant_email_settings
    ADD CONSTRAINT "PK_20fbba10fea851a38952196eced" PRIMARY KEY (id);

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT "PK_53be67a04681c66b87ee27c9321" PRIMARY KEY (id);

ALTER TABLE ONLY public.contract_email_logs
    ADD CONSTRAINT "PK_608261ed71089e9187efa623fd8" PRIMARY KEY (id);

ALTER TABLE ONLY public.product_tables
    ADD CONSTRAINT "PK_9a68777cbe1bd2839646b03cd5c" PRIMARY KEY (id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id);

ALTER TABLE ONLY public.billings
    ADD CONSTRAINT "PK_b4c005480bcc7e02a04880c8b27" PRIMARY KEY (id);

ALTER TABLE ONLY public.brokers
    ADD CONSTRAINT "PK_b8ee0411488131f6f9d322dbe7a" PRIMARY KEY (id);

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT "PK_cd102ed7a9a4ca7d4d8bfeba406" PRIMARY KEY (id);

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT "PK_f1ab7cf3a5714dbc6bb4e1c28a4" PRIMARY KEY (id);

ALTER TABLE ONLY public.tenant_pdf_settings
    ADD CONSTRAINT "UQ_0e0cbed940140f530831097d920" UNIQUE (tenant_id);

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT "UQ_2310ecc5cb8be427097154b18fc" UNIQUE (slug);

ALTER TABLE ONLY public.tenant_email_settings
    ADD CONSTRAINT "UQ_c7cddc5ef14aa813b40618695b3" UNIQUE (tenant_id);

CREATE INDEX "IDX_2cc54a94852faf0c9fcd57dd31" ON public.clients USING btree (code_client);

CREATE INDEX "IDX_853155efcb364e85d9f36650de" ON public.contract_email_logs USING btree (tenant_id, contract_id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "FK_109638590074998bb72a2f2cf08" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
`;

export class InitialSchema1790294400000 implements MigrationInterface {
  name = "InitialSchema1790294400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ exists }] = await queryRunner.query(`SELECT to_regclass('public.tenants') IS NOT NULL AS exists`);
    if (exists) return;
    await queryRunner.query(SCHEMA_SQL);
  }

  public async down(): Promise<void> {
    throw new Error("Migration inicial não é reversível.");
  }
}
