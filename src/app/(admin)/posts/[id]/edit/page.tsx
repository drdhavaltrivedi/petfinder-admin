"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PostForm from "@/components/PostForm";
import { Empty, ErrorBox, Spinner } from "@/components/ui";
import type { PostDoc } from "@/lib/models";
import { describeError, getPost, updatePost, uploadPostImage } from "@/lib/posts";

export default function EditPostPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [post, setPost] = useState<PostDoc | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPost(id).then(setPost).catch((e) => setError(describeError("Failed to load post", e)));
  }, [id]);

  if (error) return <ErrorBox message={error} />;
  if (post === undefined) return <Spinner />;
  if (post === null) return <Empty>Post not found.</Empty>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Edit post</h1>
      <PostForm
        initial={post}
        imageRequired={false}
        submitLabel="Save changes"
        busyLabel="Saving…"
        cancelHref={`/posts/${id}`}
        onSubmit={async ({ caption, category, file }) => {
          let url: string | undefined;
          if (file) {
            try {
              url = await uploadPostImage(file);
            } catch (e) {
              throw new Error(describeError("Image upload failed", e));
            }
          }
          try {
            await updatePost(id, { caption, category }, url);
          } catch (e) {
            throw new Error(describeError("Saving changes failed", e));
          }
          router.replace(`/posts/${id}`);
        }}
      />
    </div>
  );
}
