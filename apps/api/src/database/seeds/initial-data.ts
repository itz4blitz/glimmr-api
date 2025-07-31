import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hospitals, prices, analytics } from "../schema";
// import { jobs as _jobs } from "../schema"; // Moved to external processing tools

const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.DATABASE_USERNAME || "postgres"}:${process.env.DATABASE_PASSWORD || "postgres"}@${process.env.DATABASE_HOST || "localhost"}:${process.env.DATABASE_PORT || 5432}/${process.env.DATABASE_NAME || "glimmr"}`;

const client = postgres(connectionString);
const db = drizzle(client);

export async function seedInitialData() {
  console.log("🌱 Starting database seeding...");

  try {
    // Check if hospitals already exist to prevent duplicate seeding
    const existingHospitals = await db.select().from(hospitals).limit(1);
    
    if (existingHospitals.length > 0) {
      console.log("📊 Hospitals already exist, skipping hospital seeding");
      return;
    }

    console.log("📊 Seeding demo hospitals...");
    const hospitalData = await db
      .insert(hospitals)
      .values([
        {
          name: "Demo General Hospital",
          state: "CA",
          city: "Demo City",
          address: "123 Demo Street",
          zipCode: "90210",
          phone: "(555) 123-4567",
          website: "https://demo-hospital.example.com",
          bedCount: 200,
          ownership: "non-profit",
          hospitalType: "general",
          teachingStatus: false,
          npiNumber: "9999999999",
          cmsProviderNumber: "999999",
          dataSource: "demo",
        },
        {
          name: "Demo Regional Medical Center",
          state: "TX",
          city: "Demo Town",
          address: "456 Demo Avenue",
          zipCode: "77001",
          phone: "(555) 987-6543",
          website: "https://demo-medical.example.com",
          bedCount: 150,
          ownership: "for-profit",
          hospitalType: "general",
          teachingStatus: false,
          npiNumber: "9999999998",
          cmsProviderNumber: "999998",
          dataSource: "demo",
        },
        {
          name: "Demo Community Hospital",
          state: "NY",
          city: "Demo Village",
          address: "789 Demo Boulevard",
          zipCode: "10001",
          phone: "(555) 456-7890",
          website: "https://demo-community.example.com",
          bedCount: 100,
          ownership: "non-profit",
          hospitalType: "community",
          teachingStatus: false,
          npiNumber: "9999999997",
          cmsProviderNumber: "999997",
          dataSource: "demo",
        },
      ])
      .returning();

    console.log(`✅ Seeded ${hospitalData.length} demo hospitals`);

    // Seed prices for each hospital
    console.log("💰 Seeding prices...");
    const priceData = [];

    for (const hospital of hospitalData) {
      priceData.push(
        {
          hospitalId: hospital.id,
          serviceName: "Emergency Room Visit - Level 4",
          serviceCode: "99284",
          codeType: "CPT",
          description:
            "Emergency department visit for evaluation and management of a patient",
          category: "emergency",
          grossCharge: "2500.00",
          discountedCashPrice: "1800.00",
          minimumNegotiatedRate: "1200.00",
          maximumNegotiatedRate: "2200.00",
          dataSource: "cms",
          reportingPeriod: "2024-Q1",
          hasNegotiatedRates: true,
          dataQuality: "high",
        },
        {
          hospitalId: hospital.id,
          serviceName: "MRI Brain without Contrast",
          serviceCode: "70551",
          codeType: "CPT",
          description: "Magnetic resonance imaging of brain without contrast",
          category: "imaging",
          grossCharge: "3200.00",
          discountedCashPrice: "2400.00",
          minimumNegotiatedRate: "1800.00",
          maximumNegotiatedRate: "2800.00",
          dataSource: "cms",
          reportingPeriod: "2024-Q1",
          hasNegotiatedRates: true,
          dataQuality: "high",
        },
        {
          hospitalId: hospital.id,
          serviceName: "Appendectomy - Laparoscopic",
          serviceCode: "44970",
          codeType: "CPT",
          description: "Laparoscopic appendectomy",
          category: "surgery",
          grossCharge: "15000.00",
          discountedCashPrice: "12000.00",
          minimumNegotiatedRate: "8000.00",
          maximumNegotiatedRate: "13000.00",
          dataSource: "cms",
          reportingPeriod: "2024-Q1",
          hasNegotiatedRates: true,
          dataQuality: "high",
        },
      );
    }

    const insertedPrices = await db
      .insert(prices)
      .values(priceData)
      .returning();
    console.log(`✅ Seeded ${insertedPrices.length} price records`);

    // Seed analytics
    console.log("📈 Seeding analytics...");
    const analyticsData = await db
      .insert(analytics)
      .values([
        {
          metricName: "average_er_visit_cost",
          metricType: "average",
          value: "2166.67",
          serviceCategory: "emergency",
          serviceName: "Emergency Room Visit - Level 4",
          period: "2024-Q1",
          periodType: "quarter",
          sampleSize: 3,
          confidence: "0.95",
        },
        {
          metricName: "average_mri_cost",
          metricType: "average",
          value: "2866.67",
          serviceCategory: "imaging",
          serviceName: "MRI Brain without Contrast",
          period: "2024-Q1",
          periodType: "quarter",
          sampleSize: 3,
          confidence: "0.95",
        },
        {
          metricName: "hospital_count_by_state",
          metricType: "count",
          value: "1",
          state: "MN",
          period: "2024-Q1",
          periodType: "quarter",
          sampleSize: 1,
        },
        {
          metricName: "hospital_count_by_state",
          metricType: "count",
          value: "1",
          state: "OH",
          period: "2024-Q1",
          periodType: "quarter",
          sampleSize: 1,
        },
        {
          metricName: "hospital_count_by_state",
          metricType: "count",
          value: "1",
          state: "MD",
          period: "2024-Q1",
          periodType: "quarter",
          sampleSize: 1,
        },
      ])
      .returning();

    console.log(`✅ Seeded ${analyticsData.length} analytics records`);

    console.log("🎉 Database seeding completed successfully!");
  } catch (_error) {
    console.error("Error", _error);
    throw _error;
  } finally {
    await client.end();
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedInitialData().catch(console.error);
}
