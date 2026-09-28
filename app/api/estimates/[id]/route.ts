import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Diagnostic console logs (Viewable in your terminal running `npm run dev`)
    console.log("-----------------------------------------");
    console.log("[API GET /api/estimates/[id]] Received ID parameter:", id);

    if (!id) {
      console.log("[API GET] Error: Missing estimate ID parameter.");
      return NextResponse.json({ error: "Missing estimate ID" }, { status: 400 });
    }

    // Query Supabase for estimate
    const { data: estimate, error: estError } = await supabase
      .from("estimates")
      .select("*")
      .eq("id", id)
      .single();

    if (estError) {
      console.error("[API GET] Supabase query error for estimate:", estError.message);
      return NextResponse.json({ error: "Estimate not found: " + estError.message }, { status: 404 });
    }

    if (!estimate) {
      console.log("[API GET] No record found in Supabase matching ID:", id);
      return NextResponse.json({ error: "Estimate not found in database" }, { status: 404 });
    }

    console.log("[API GET] Successfully retrieved estimate:", estimate.id);

    // Query associated line items
    const { data: lineItems, error: itemsError } = await supabase
      .from("line_items")
      .select("*")
      .eq("estimate_id", id);

    if (itemsError) {
      console.error("[API GET] Supabase query error for line_items:", itemsError.message);
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    return NextResponse.json({ estimate, lineItems: lineItems || [] });
  } catch (err: any) {
    console.error("[API GET] Internal server exception:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    console.log("-----------------------------------------");
    console.log("[API PUT /api/estimates/[id]] Updating estimate ID:", id);

    const {
      client_name,
      client_email,
      client_phone,
      job_address,
      require_deposit,
      deposit_percentage,
      package_options,
      trade,
      lineItems,
    } = body;

    // Update primary Estimate details
    const { error: estError } = await supabase
      .from("estimates")
      .update({
        client_name,
        client_email,
        client_phone,
        job_address,
        require_deposit,
        deposit_percentage,
        package_options,
        trade,
        status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (estError) {
      console.error("[API PUT] Error updating estimate row:", estError.message);
      throw estError;
    }

    // Delete existing line items to replace with updated list
    const { error: deleteError } = await supabase
      .from("line_items")
      .delete()
      .eq("estimate_id", id);

    if (deleteError) {
      console.error("[API PUT] Error clearing old line items:", deleteError.message);
      throw deleteError;
    }

    // Format & insert new line items
    if (lineItems && lineItems.length > 0) {
      const formattedItems = lineItems.map((item: any) => ({
        estimate_id: id,
        description: item.description,
        quantity: Number(item.quantity) || 0,
        unit_price: Number(item.unit_price) || 0,
      }));

      const { error: insertError } = await supabase
        .from("line_items")
        .insert(formattedItems);

      if (insertError) {
        console.error("[API PUT] Error inserting line items:", insertError.message);
        throw insertError;
      }
    }

    console.log("[API PUT] Successfully updated estimate and line items for ID:", id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[API PUT] Exception:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
