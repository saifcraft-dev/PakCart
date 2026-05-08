import SEO from "@/components/SEO";

export default function Terms() {
  const lastUpdated = "February 07, 2026";

  return (
    <>
      <SEO
        title="Terms & Conditions - PakCart"
        description="Read PakCart's terms and conditions for using our online shopping platform in Pakistan. Learn about your rights and our policies."
        url="https://pakcart.store/terms"
        robots="index,follow"
      />
      <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto prose prose-emerald dark:prose-invert">
        <h1 className="text-4xl font-serif text-emerald-900 mb-4">Terms & Conditions</h1>
        <p className="text-muted-foreground mb-8">Last updated: {lastUpdated}</p>

        <section className="mb-8">
          <h2 className="text-2xl font-serif text-emerald-800">1. Terms of Use</h2>
          <p>
            By accessing this website, you are agreeing to be bound by these website Terms and Conditions of Use, 
            all applicable laws and regulations, and agree that you are responsible for compliance with any 
            applicable local laws. If you do not agree with any of these terms, you are prohibited from 
            using or accessing this site.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-serif text-emerald-800">2. Use License</h2>
          <p>
            Permission is granted to temporarily download one copy of the materials (information or software) 
            on PakCart's website for personal, non-commercial transitory viewing only.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-serif text-emerald-800">3. Disclaimer</h2>
          <p>
            The materials on PakCart's website are provided "as is". PakCart makes no warranties, 
            expressed or implied, and hereby disclaims and negates all other warranties, including without 
            limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, 
            or non-infringement of intellectual property or other violation of rights.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-serif text-emerald-800">4. Shipping & Returns</h2>
          <p>
            We offer nationwide delivery across Pakistan. Standard delivery times are 3-5 business days. 
            If a product arrives damaged or defective, contact us at support@pakcart.store with photos and your order number and we will arrange a replacement.
            Perishable food items are not eligible for returns unless damaged during transit.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-serif text-emerald-800">5. Governing Law</h2>
          <p>
            Any claim relating to PakCart's website shall be governed by the laws of Pakistan without 
            regard to its conflict of law provisions.
          </p>
        </section>
      </div>
      </div>
    </>
  );
}
