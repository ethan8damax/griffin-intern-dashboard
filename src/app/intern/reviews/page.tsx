import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import type { ReviewDoc } from "@/lib/auth/types";

export default async function InternReviewsPage() {
  const user = await requireRole("intern");

  let reviews: (ReviewDoc & { id: string })[] = [];
  if (user.engagementId) {
    const reviewsSnapshot = await getAdminDb()
      .collection("engagements")
      .doc(user.engagementId)
      .collection("reviews")
      .where("subjectUserId", "==", user.uid)
      .get();
    reviews = reviewsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as ReviewDoc),
    }));
  }

  return (
    <main>
      <p>
        <a href="/intern">← Back</a>
      </p>
      <h1>Your reviews</h1>
      <ul>
        {reviews.map((review) => (
          <li key={review.id}>
            {review.reviewerName} ({review.reviewerRole}) — {review.status},
            requested {review.requestedDate}
            {review.submittedDate && <> — submitted {review.submittedDate}</>}
          </li>
        ))}
      </ul>
    </main>
  );
}
