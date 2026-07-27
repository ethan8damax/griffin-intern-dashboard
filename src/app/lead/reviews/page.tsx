import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { requireEngagementId } from "@/lib/auth/ownership";
import { createReview } from "../reviews-actions";
import type { ReviewDoc } from "@/lib/auth/types";

export default async function ReviewsPage() {
  const lead = await requireRole("engagementLead");
  const engagementId = requireEngagementId(lead);

  const reviewsSnapshot = await getAdminDb()
    .collection("engagements")
    .doc(engagementId)
    .collection("reviews")
    .get();
  const reviews = reviewsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as ReviewDoc),
  }));

  return (
    <main>
      <p>
        <a href="/lead">← Back</a>
      </p>
      <h1>Reviews</h1>
      <ul>
        {reviews.map((review) => (
          <li key={review.id}>
            Subject: {review.subjectUserId} — {review.reviewerName} (
            {review.reviewerRole}) — {review.status}, requested{" "}
            {review.requestedDate}
          </li>
        ))}
      </ul>

      <h2>Request a review</h2>
      <form action={createReview}>
        <label>
          Intern uid
          <input name="subjectUserId" required />
        </label>
        <label>
          Reviewer name
          <input name="reviewerName" required />
        </label>
        <label>
          Reviewer role
          <input name="reviewerRole" />
        </label>
        <button type="submit">Create</button>
      </form>
    </main>
  );
}
